import * as fs from "fs-extra"
import * as prompts from "prompts"
import ProgressBar from "progress"
import { execWrapper } from "../db/execWrapper.js"
import { spawn } from "child_process"
import simpleGit, { SimpleGit } from "simple-git"
import { WriteStream } from "tty"
import { ProgressStream } from "./ProgressStream.js"
import { DeployTarget, ProdTarget } from "./DeployTarget.js"

const TEMP_DEPLOY_SCRIPT_PREFIX = `tempDeployScript.`

interface DeployerOptions {
    owidGrapherRootDir: string
    userRunningTheDeploy: string
    target: DeployTarget
    skipChecks?: boolean
    runChecksRemotely?: boolean
}

const OWID_STAGING_DROPLET_IP = "165.22.127.239"
const OWID_LIVE_DROPLET_IP = "209.97.185.49"

export class Deployer {
    private options: DeployerOptions
    private progressBar: ProgressBar
    private stream: ProgressStream
    constructor(options: DeployerOptions) {
        this.options = options
        const { target, skipChecks, runChecksRemotely } = this.options

        this.stream = new ProgressStream(process.stderr)
        // todo: a smarter way to precompute out the number of steps?
        const testSteps = !skipChecks && !runChecksRemotely ? 1 : 0
        this.progressBar = new ProgressBar(
            `Baking and deploying to ${target} [:bar] :current/:total :elapseds :name\n`,
            {
                total: 24 + testSteps,
                renderThrottle: 0, // print on every tick
                stream: this.stream as unknown as WriteStream,
            }
        )
    }

    private async runAndTick(command: string) {
        await execWrapper(command)
        this.progressBar.tick({ name: `✅  finished ${command}` })
    }

    private get isValidTarget() {
        return new Set(Object.values(DeployTarget)).has(this.options.target)
    }

    get targetIsProd() {
        return this.options.target === ProdTarget
    }

    private get targetIpAddress() {
        return this.targetIsProd
            ? OWID_LIVE_DROPLET_IP
            : OWID_STAGING_DROPLET_IP
    }

    // todo: I have not tested this yet, and would be surprised if it worked on the first attempt.
    private async runPreDeployChecksRemotely() {
        const { owidGrapherRootDir } = this.options
        const { rsyncTargetDirForTests } = this.pathsOnTarget
        const RSYNC_TESTS = `rsync -havz --no-perms --progress --delete --include=/test --include=*.test.ts --include=*.test.tsx --exclude-from=${owidGrapherRootDir}/.rsync-ignore`
        await execWrapper(
            `${RSYNC_TESTS} ${owidGrapherRootDir} ${this.sshHost}:${rsyncTargetDirForTests}`
        )

        const script = `cd ${rsyncTargetDirForTests}
yarn install --immutable
yarn testPrettierAll`
        await execWrapper(`ssh -t ${this.sshHost} 'bash -e -s' ${script}`)

        this.progressBar.tick({
            name: "✅📡 finished running predeploy checks remotely",
        })
    }

    private async runLiveSafetyChecks() {
        const { simpleGit } = this
        const branches = await simpleGit.branchLocal()
        const branch = await branches.current
        if (branch !== "master")
            this.printAndExit(
                "To deploy to live please run from the master branch."
            )

        // Making sure we have the latest changes from the upstream
        // Also, will fail if working copy is not clean
        try {
            const gitStatus = await simpleGit.status()
            // gitStatus.isClean() checks for staged, unstaged, and untracked files
            if (!gitStatus.isClean()) throw "Git working directory is not clean"

            await simpleGit.pull("origin", undefined, { "--rebase": "true" })
        } catch (err) {
            this.printAndExit(JSON.stringify(err))
        }

        const response = await prompts.prompt({
            type: "confirm",
            name: "confirmed",
            message: "Are you sure you want to deploy to live?",
        })
        if (!response?.confirmed) this.printAndExit("Cancelled")
    }

    private _simpleGit?: SimpleGit
    private get simpleGit() {
        if (!this._simpleGit)
            this._simpleGit = simpleGit({
                baseDir: this.options.owidGrapherRootDir,
                binary: "git",
                maxConcurrentProcesses: 1,
            })
        return this._simpleGit
    }

    private get pathsOnTarget() {
        const { target, userRunningTheDeploy } = this.options
        const owidUserHomeDir = "/home/owid"
        const owidUserHomeTmpDir = `${owidUserHomeDir}/tmp`

        return {
            owidUserHomeDir,
            owidUserHomeTmpDir,
            rsyncTargetDir: `${owidUserHomeTmpDir}/${target}-${userRunningTheDeploy}`,
            rsyncTargetDirTmp: `${owidUserHomeTmpDir}/${target}-${userRunningTheDeploy}-tmp`,
            rsyncTargetDirForTests: `${owidUserHomeTmpDir}/${target}-tests`,
            finalTargetDir: `${owidUserHomeDir}/${target}`,
            oldRepoBackupDir: `${owidUserHomeTmpDir}/${target}-old`,
            finalDataDir: `${owidUserHomeDir}/${target}-data`,
        }
    }

    private get sshHost() {
        return `owid@${this.targetIpAddress}`
    }

    private async writeHeadDotText() {
        const { simpleGit } = this
        const { owidGrapherRootDir } = this.options
        const gitCommitSHA = await simpleGit.revparse(["HEAD"])

        // Write the current commit SHA to public/head.txt so we always know which commit is deployed
        fs.writeFileSync(
            owidGrapherRootDir + "/public/head.txt",
            gitCommitSHA,
            "utf8"
        )
        this.progressBar.tick({ name: "✅ finished writing head.txt" })
    }

    // 📡 indicates that a task is running/ran on the remote server
    async buildAndDeploy() {
        const { skipChecks, runChecksRemotely } = this.options

        if (this.targetIsProd) await this.runLiveSafetyChecks()
        else if (!this.isValidTarget)
            this.printAndExit(
                "Please select either live or a valid test target."
            )

        this.progressBar.tick({
            name: "✅ finished validating deploy arguments",
        })

        // make sure that no old assets are left over from an old deploy
        await this.runAndTick(`yarn cleanTsc`)
        await this.runAndTick(`yarn buildTsc`)

        if (runChecksRemotely) await this.runPreDeployChecksRemotely()
        else if (skipChecks) {
            if (this.targetIsProd)
                this.printAndExit(`Cannot skip checks when deploying to live`)
            this.progressBar.tick({
                name: "✅ finished checks because we skipped them",
            })
        } else {
            await this.runAndTick(`yarn testPrettierChanged`)
            await this.runAndTick(`yarn testJest`)
        }

        await this.writeHeadDotText()
        await this.ensureTmpDirExistsOnServer()

        const exitCode = await this.generateShellScriptsAndRunThemOnServer()
        if (exitCode !== 0) return

        this.progressBar.tick({
            name: `✅ 📡 finished everything`,
        })
        this.stream.replay()
    }

    // todo: the old deploy script would generete BASH on the fly and run it on the server. we should clean that up and remove these shell scripts.
    private async generateShellScriptsAndRunThemOnServer(): Promise<number> {
        const { simpleGit } = this
        const { target, owidGrapherRootDir } = this.options

        const {
            rsyncTargetDirTmp,
            finalTargetDir,
            rsyncTargetDir,
            oldRepoBackupDir,
            finalDataDir,
        } = this.pathsOnTarget

        const gitConfig = await simpleGit.listConfig()
        const gitName = `${gitConfig.all["user.name"]}`
        const gitEmail = `${gitConfig.all["user.email"]}`

        const scripts: any = {
            clearOldTemporaryRepo: `rm -rf ${rsyncTargetDirTmp}`,
            copySyncedRepo: `cp -r ${rsyncTargetDir} ${rsyncTargetDirTmp}`, // Copy the synced repo-- this is because we're about to move it, and we want the original target to stay around to make future syncs faster
            createDataSoftlinks: `mkdir -p ${finalDataDir}/bakedSite && ln -sf ${finalDataDir}/bakedSite ${rsyncTargetDirTmp}/bakedSite`,
            createDatasetSoftlinks: `mkdir -p ${finalDataDir}/datasetsExport && ln -sf ${finalDataDir}/datasetsExport ${rsyncTargetDirTmp}/datasetsExport`,
            createSettingsSoftlinks: `ln -sf ${finalDataDir}/.env ${rsyncTargetDirTmp}/.env`,
            yarn: `cd ${rsyncTargetDirTmp} && yarn install --immutable`,
            lernaBuild: `cd ${rsyncTargetDirTmp} && yarn lerna run build`,
            webpack: `cd ${rsyncTargetDirTmp} && yarn buildVite`,
            migrateDb: `cd ${rsyncTargetDirTmp} && yarn runDbMigrations`,
            algolia: `cd ${rsyncTargetDirTmp} && node --unhandled-rejections=strict itsJustJavascript/baker/algolia/configureAlgolia.js`,
            createQueueFile: `cd ${rsyncTargetDirTmp} && touch .queue && chmod 0666 .queue`,
            swapFolders: `rm -rf ${oldRepoBackupDir} && mv ${finalTargetDir} ${oldRepoBackupDir} || true && mv ${rsyncTargetDirTmp} ${finalTargetDir}`,
            restartAdminServer: `pm2 restart ${target}`,
            stopDeployQueueServer: `pm2 stop ${target}-deploy-queue`,
            bakeSiteOnStagingServer: `cd ${finalTargetDir} && node --unhandled-rejections=strict itsJustJavascript/baker/bakeSiteOnStagingServer.js`,
            deployToNetlify: `cd ${finalTargetDir} && node --unhandled-rejections=strict itsJustJavascript/baker/deploySiteFromStagingServer.js "${gitEmail}" "${gitName}"`,
            restartQueue: `pm2 start ${target}-deploy-queue`,
        }

        Object.keys(scripts).forEach((name) => {
            const localPath = `${owidGrapherRootDir}/${TEMP_DEPLOY_SCRIPT_PREFIX}${name}.sh`
            fs.writeFileSync(localPath, scripts[name], "utf8")
            fs.chmodSync(localPath, "755")
        })

        await this.copyLocalRepoToServerTmpDirectory()

        let exitCode: number = 0
        for await (const name of Object.keys(scripts)) {
            exitCode = await this.runAndStreamScriptOnRemoteServerViaSSH(
                `${rsyncTargetDir}/${TEMP_DEPLOY_SCRIPT_PREFIX}${name}.sh`
            )
            const localPath = `${owidGrapherRootDir}/${TEMP_DEPLOY_SCRIPT_PREFIX}${name}.sh`
            fs.removeSync(localPath)
            if (exitCode !== 0) break // halt the deploy sequence
        }

        return exitCode
    }

    printAndExit(message: string) {
        // eslint-disable-next-line no-console
        console.log(message)
        process.exit()
    }

    private async ensureTmpDirExistsOnServer() {
        const { sshHost } = this
        const { owidUserHomeTmpDir } = this.pathsOnTarget
        await execWrapper(`ssh ${sshHost} mkdir -p ${owidUserHomeTmpDir}`)
        this.progressBar.tick({
            name: `✅ 📡 finished ensuring ${owidUserHomeTmpDir} exists on ${sshHost}`,
        })
    }

    private async copyLocalRepoToServerTmpDirectory() {
        const { owidGrapherRootDir } = this.options
        const { rsyncTargetDir } = this.pathsOnTarget
        const RSYNC = `rsync -havz --no-perms --progress --delete --delete-excluded --prune-empty-dirs --exclude-from=${owidGrapherRootDir}/.rsync-ignore`
        await execWrapper(
            `${RSYNC} ${owidGrapherRootDir}/ ${this.sshHost}:${rsyncTargetDir}`
        )
        this.progressBar.tick({
            name: `✅ 📡 finished rsync of ${owidGrapherRootDir} to ${this.sshHost} ${rsyncTargetDir}`,
        })
    }

    private async runAndStreamScriptOnRemoteServerViaSSH(
        path: string
    ): Promise<number> {
        // eslint-disable-next-line no-console
        console.log(`📡 Running ${path} on ${this.sshHost}`)
        const bashTerminateIfAnyNonZero = "bash -e" // https://stackoverflow.com/questions/9952177/whats-the-meaning-of-the-parameter-e-for-bash-shell-command-line/9952249
        const pseudoTty = "-tt" // https://stackoverflow.com/questions/7114990/pseudo-terminal-will-not-be-allocated-because-stdin-is-not-a-terminal
        const params = [
            pseudoTty,
            this.sshHost,
            bashTerminateIfAnyNonZero,
            path,
        ]
        const child = spawn(`ssh`, params)

        child.stdout.on("data", (data) => {
            const trimmed = data.toString().trim()
            if (!trimmed) return
            // eslint-disable-next-line no-console
            console.log(trimmed)
        })

        child.stderr.on("data", (data) => {
            const trimmed = data.toString().trim()
            if (!trimmed) return
            // eslint-disable-next-line no-console
            console.error(trimmed)
        })

        const exitCode: number = await new Promise((resolve) => {
            child.on("close", resolve)
        })

        this.progressBar.tick({
            name: `📡${
                exitCode ? "⛔️ failed" : "✅ finished"
            } running ${path}${exitCode ? ` [exit code: ${exitCode}]` : ``}`,
        })

        return exitCode
    }
}
