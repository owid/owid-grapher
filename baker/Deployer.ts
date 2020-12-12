import * as fs from "fs-extra"
import * as prompts from "prompts"
import ProgressBar = require("progress")
import { execWrapper } from "../db/execWrapper"
import { spawn } from "child_process"
import simpleGit, { SimpleGit } from "simple-git"
import { WriteStream } from "tty"
import { ProgressStream } from "./ProgressStream"
import { DeployTarget, ProdTarget } from "./DeployTarget"

const TEMP_DEPLOY_SCRIPT_SUFFIX = `.tempDeployScript.sh`

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
        const testSteps = !skipChecks && !runChecksRemotely ? 2 : 0
        this.progressBar = new ProgressBar(
            `Baking and deploying to ${target} [:bar] :current/:total :elapseds :name\n`,
            {
                total: 20 + testSteps,
                renderThrottle: 0, // print on every tick
                stream: (this.stream as unknown) as WriteStream,
            }
        )
    }

    private async runAndTick(command: string) {
        await execWrapper(command)
        this.progressBar.tick({ name: `✅  finished ${command}` })
    }

    private get targetIsStaging() {
        return new Set(Object.values(DeployTarget)).has(this.options.target)
    }

    get targetIsProd() {
        return this.options.target === ProdTarget
    }

    private get targetIpAddress() {
        return this.targetIsStaging
            ? OWID_STAGING_DROPLET_IP
            : OWID_LIVE_DROPLET_IP
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
yarn install --production=false --frozen-lockfile
yarn checkPrettierAll`
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
            await simpleGit.pull("origin", undefined, { "--rebase": "true" })
        } catch (err) {
            this.printAndExit(JSON.stringify(err))
        }

        const response = await prompts.prompt({
            type: "confirm",
            name: "confirmed",
            message: "Are you sure you want to deploy to live?",
        })
        if (!response) this.printAndExit("Cancelled")
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
            oldRepoBackupDir: `${owidUserHomeTmpDir}-old`,
            dataDir: `${owidUserHomeTmpDir}/${target}-data`,
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
    async deploy() {
        const { skipChecks, runChecksRemotely } = this.options

        if (this.targetIsProd) await this.runLiveSafetyChecks()
        else if (!this.targetIsStaging)
            this.printAndExit(
                "Please select either live or a valid test target."
            )

        this.progressBar.tick({
            name: "✅ finished validating deploy arguments",
        })

        if (runChecksRemotely) await this.runPreDeployChecksRemotely()
        else if (skipChecks) {
            if (this.targetIsProd)
                this.printAndExit(`Cannot skip checks when deploying to live`)
            this.progressBar.tick({
                name: "✅ finished checks because we skipped them",
            })
        } else {
            await this.runAndTick(`yarn checkPrettierChanged`)
            await this.runAndTick(`yarn buildTsc`)
            await this.runAndTick(`yarn checkJest`)
        }

        await this.writeHeadDotText()
        await this.ensureTmpDirExistsOnServer()
        await this.generateShellScriptsAndRunThemOnServer()

        this.progressBar.tick({
            name: `✅ 📡 finished everything`,
        })
        this.stream.replay()
    }

    // todo: the old deploy script would generete BASH on the fly and run it on the server. we should clean that up and remove these shell scripts.
    private async generateShellScriptsAndRunThemOnServer() {
        const { simpleGit } = this
        const { target, owidGrapherRootDir } = this.options

        const {
            rsyncTargetDirTmp,
            finalTargetDir,
            rsyncTargetDir,
            owidUserHomeTmpDir,
            owidUserHomeDir,
            oldRepoBackupDir,
            dataDir,
        } = this.pathsOnTarget

        const gitConfig = await simpleGit.listConfig()
        const gitName = `${gitConfig.all["user.name"]}`
        const gitEmail = `${gitConfig.all["user.email"]}`

        const scripts: any = {
            clearOldTemporaryRepo: `rm -rf ${rsyncTargetDirTmp}`,
            copySyncedRepo: `cp -r ${rsyncTargetDir} ${rsyncTargetDirTmp}`, // Copy the synced repo-- this is because we're about to move it, and we want the original target to stay around to make future syncs faster
            createDataSoftlinks: `mkdir -p ${dataDir}/bakedSite && ln -sf ${dataDir}/bakedSite ${rsyncTargetDir}/bakedSite`,
            createDatasetSoftlinks: `mkdir -p ${dataDir}/datasetsExport && ln -sf ${dataDir}/datasetsExport ${rsyncTargetDir}/datasetsExport`,
            yarn: `cd ${rsyncTargetDirTmp} && yarn install --production --frozen-lockfile`,
            webpack: `cd ${rsyncTargetDirTmp} && yarn buildWebpack`,
            algolia: `cd ${rsyncTargetDirTmp} && node itsJustJavascript/baker/algolia/configureAlgolia.js`,
            createQueueFile: `cd ${finalTargetDir} && touch .queue && chmod 0666 .queue`,
            swapFolders: `rm -rf ${oldRepoBackupDir} && mv ${finalTargetDir} ${oldRepoBackupDir} || true && mv ${rsyncTargetDirTmp} ${finalTargetDir}`,
            restartAdminServer: `pm2 restart ${target}`,
            stopDeployQueueServer: `pm2 stop ${target}-deploy-queue`,
            bakeSiteOnStagingServer: `cd ${finalTargetDir} && node itsJustJavascript/baker/bakeSiteOnStagingServer.js`,
            deployToNetlify: `cd ${finalTargetDir} && node itsJustJavascript/baker/deploySiteFromStagingServer.js "${gitEmail}" "${gitName}"`,
            restartQueue: `pm2 start ${target}-deploy-queue`,
        }

        Object.keys(scripts).forEach((name) => {
            const localPath = `${owidGrapherRootDir}/${name}${TEMP_DEPLOY_SCRIPT_SUFFIX}`
            fs.writeFileSync(localPath, scripts[name], "utf8")
            fs.chmodSync(localPath, "755")
        })

        await this.copyLocalRepoToServerTmpDirectory()

        for await (const name of Object.keys(scripts)) {
            await this.runAndStreamScriptOnRemoteServerViaSSH(
                `${rsyncTargetDir}/${name}${TEMP_DEPLOY_SCRIPT_SUFFIX}`
            )
        }
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
        const RSYNC = `rsync -havz --no-perms --progress --delete --delete-excluded --exclude-from=${owidGrapherRootDir}/.rsync-ignore`
        await execWrapper(
            `${RSYNC} ${owidGrapherRootDir}/ ${this.sshHost}:${rsyncTargetDir}`
        )
        this.progressBar.tick({
            name: `✅ 📡 finished rsync of ${owidGrapherRootDir} to ${this.sshHost} ${rsyncTargetDir}`,
        })
    }

    private async runAndStreamScriptOnRemoteServerViaSSH(path: string) {
        // eslint-disable-next-line no-console
        console.log(`📡 Running ${path} on ${this.sshHost}`)
        const params = [`-t`, this.sshHost, "bash -e", path]
        const child = spawn(`ssh`, params)

        child.stdout.on("data", (data) => {
            // eslint-disable-next-line no-console
            console.log(data.toString())
        })

        child.stderr.on("data", (data) => {
            // eslint-disable-next-line no-console
            console.log(data.toString())
        })

        const exitCode = await new Promise((resolve) => {
            child.on("close", resolve)
        })

        if (exitCode) {
            // eslint-disable-next-line no-console
            console.log(`Exit code: ${exitCode}`)
        }

        this.progressBar.tick({
            name: `✅ 📡 finished running ${path}`,
        })
    }
}
