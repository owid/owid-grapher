#! /usr/bin/env yarn tsn

import * as fs from "fs-extra"
import os from "os"
import * as path from "path"
import parseArgs from "minimist"
import * as prompts from "prompts"
import ProgressBar = require("progress")
import { exec } from "utils/server/serverUtil"
import { spawn } from "child_process"
import simpleGit, { SimpleGit } from "simple-git"

const TEMP_DEPLOY_SCRIPT_SUFFIX = `.tempDeployScript.sh`

const runLiveSafetyChecks = async (dir: string, git: SimpleGit) => {
    const branches = await git.branchLocal()
    const branch = await branches.current
    if (branch !== "master")
        printAndExit("To deploy to live please run from the master branch.")

    // Making sure we have the latest changes from the upstream
    // Also, will fail if working copy is not clean
    try {
        await git.pull("origin", undefined, { "--rebase": "true" })
    } catch (err) {
        printAndExit(JSON.stringify(err))
    }

    const response = await prompts.prompt({
        type: "confirm",
        name: "confirmed",
        message: "Are you sure you want to deploy to live?",
    })
    if (!response) printAndExit("Cancelled")
}

// todo: I have not tested this yet, and would be surprised if it worked on the first attempt.
const runPreDeployChecksRemotely = async (
    dir: string,
    HOST: string,
    SYNC_TARGET_TESTS: string
) => {
    const RSYNC_TESTS = `rsync -havz --no-perms --progress --delete --include=/test --include=*.test.ts --include=*.test.tsx --exclude-from=${dir}/.rsync-ignore`
    await exec(`${RSYNC_TESTS} ${dir} ${HOST}:${SYNC_TARGET_TESTS}`)

    const script = `cd ${SYNC_TARGET_TESTS}
yarn install --production=false --frozen-lockfile
yarn testcheck`
    return await exec(`ssh -t ${HOST} 'bash -e -s' ${script}`)
}

const LIVE_NAME = "live"

const printAndExit = (message: string) => {
    // eslint-disable-next-line no-console
    console.log(message)
    process.exit()
}

const runAndTick = async (command: string, progressBar: ProgressBar) => {
    await exec(command)
    progressBar.tick({ name: `✅ ${command}` })
}

// 📡 indicates that a task is running/ran on the remote server
const main = async () => {
    const parsedArgs = parseArgs(process.argv.slice(2))
    const runChecksRemotely = parsedArgs["r"] === true
    const skipChecks = parsedArgs["skip-checks"] === true
    const firstArg = parsedArgs["_"][0]

    const USER = os.userInfo().username
    const DIR = path.normalize(__dirname + "/../")
    const NAME = firstArg
    const stagingServers = new Set([
        "staging",
        "hans",
        "playfair",
        "jefferson",
        "nightingale",
        "explorer",
        "exemplars",
        "tufte",
        "roser",
    ])

    const git = simpleGit({
        baseDir: DIR,
        binary: "git",
        maxConcurrentProcesses: 1,
    })
    const gitStatus = await git.status()
    const gitConfig = await git.listConfig()
    const gitName = `${gitConfig.all["user.name"]}`
    const gitEmail = `${gitConfig.all["user.email"]}`

    let HOST = ""
    if (stagingServers.has(NAME)) HOST = "owid@165.22.127.239"
    else if (NAME === LIVE_NAME) {
        HOST = "owid@209.97.185.49"
        await runLiveSafetyChecks(DIR, git)
    } else printAndExit("Please select either live or a valid test target.")

    const testSteps = !skipChecks && !runChecksRemotely ? 2 : 0
    const scriptSteps = 4
    const progressBar = new ProgressBar(
        `Baking and deploying to ${NAME} [:bar] :current/:total :elapseds :name\n`,
        {
            total: 5 + scriptSteps + testSteps,
            renderThrottle: 0, // print on every tick
        }
    )

    progressBar.tick({ name: "✅ set params and run checks" })

    const ROOT = "/home/owid"
    const ROOT_TMP = `${ROOT}/tmp`
    const SYNC_TARGET = `${ROOT_TMP}/${NAME}-${USER}`
    const SYNC_TARGET_TESTS = `${ROOT_TMP}/${NAME}-tests`
    const TMP_NEW = `${ROOT_TMP}/${NAME}-${USER}-tmp`
    const FINAL_TARGET = `${ROOT}/${NAME}`

    if (runChecksRemotely) {
        await runPreDeployChecksRemotely(DIR, HOST, SYNC_TARGET_TESTS)
        progressBar.tick({ name: "✅📡 runPreDeployChecksRemotely" })
    } else if (skipChecks) {
        if (NAME === LIVE_NAME)
            printAndExit(`Cannot skip checks when deploying to live`)
        progressBar.tick({ name: "✅ skip checks" })
    } else {
        await runAndTick(`yarn prettify:check`, progressBar)
        await runAndTick(`yarn typecheck`, progressBar)
        await runAndTick(`yarn test`, progressBar)
    }

    // Write the current commit SHA to public/head.txt so we always know which commit is deployed
    fs.writeFileSync(DIR + "/public/head.txt", gitStatus.current, "utf8")
    progressBar.tick({ name: "✅ write head.txt" })

    await ensureTmpDirExistsOnServer(HOST, ROOT_TMP)
    progressBar.tick({ name: `✅ 📡${ROOT_TMP} exists on ${HOST}` })

    const scripts: any = {
        file: makeScriptToDoFileStuff(ROOT, NAME, SYNC_TARGET, TMP_NEW),
        yarn: makeScriptToDoYarnStuff(TMP_NEW),
        bake: makeScriptToDoQueueStuffDoFileStuffDoAdminServerStuffDoBake(
            NAME,
            ROOT_TMP,
            TMP_NEW,
            FINAL_TARGET
        ),
        deploy: makeScriptToDeployToNetlifyDoQueue(
            NAME,
            gitEmail,
            gitName,
            FINAL_TARGET
        ),
    }

    Object.keys(scripts).forEach((name) => {
        const fullName = `${name}${TEMP_DEPLOY_SCRIPT_SUFFIX}`
        const localPath = `${DIR}/${fullName}`
        fs.writeFileSync(localPath, scripts[name], "utf8")
        fs.chmodSync(localPath, "755")
    })

    await copyLocalRepoToServerTmpDirectory(HOST, DIR, SYNC_TARGET)
    progressBar.tick({
        name: `✅ 📡${DIR} repo rsynced to ${HOST} ${SYNC_TARGET}`,
    })

    for await (const name of Object.keys(scripts)) {
        const fullName = `${name}${TEMP_DEPLOY_SCRIPT_SUFFIX}`
        const remoteScriptPath = `${SYNC_TARGET}/${fullName}`
        // eslint-disable-next-line no-console
        console.log(`📡 Running ${remoteScriptPath} on ${HOST}`)
        await runAndStreamScriptOnRemoteServerViaSSH(HOST, remoteScriptPath)
        progressBar.tick({
            name: `✅ 📡${DIR} ${remoteScriptPath}`,
        })
    }
}

const ensureTmpDirExistsOnServer = async (HOST: string, ROOT_TMP: string) => {
    await exec(`ssh ${HOST} mkdir -p ${ROOT_TMP}`)
}

const copyLocalRepoToServerTmpDirectory = async (
    HOST: string,
    DIR: string,
    SYNC_TARGET: string
) => {
    const RSYNC = `rsync -havz --no-perms --progress --delete --delete-excluded --exclude-from=${DIR}/.rsync-ignore`
    return await exec(`${RSYNC} ${DIR}/ ${HOST}:${SYNC_TARGET}`)
}

const runAndStreamScriptOnRemoteServerViaSSH = async (
    host: string,
    path: string
) => {
    const params = [`-t`, host, "bash -e", path]
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
}

const makeScriptToDoFileStuff = (
    ROOT: string,
    NAME: string,
    SYNC_TARGET: string,
    TMP_NEW: string
) => {
    const FINAL_DATA = `${ROOT}/${NAME}-data`

    return `# Remove any previous temporary repo
rm -rf ${TMP_NEW}

# Copy the synced repo-- this is because we're about to move it, and we want the
# original target to stay around to make future syncs faster
cp -r ${SYNC_TARGET} ${TMP_NEW}

# Link in all the persistent stuff that needs to stay around between versions
ln -sf ${FINAL_DATA}/.env ${TMP_NEW}/.env
mkdir -p ${FINAL_DATA}/bakedSite
ln -sf ${FINAL_DATA}/bakedSite ${TMP_NEW}/bakedSite
mkdir -p ${FINAL_DATA}/datasetsExport
ln -sf ${FINAL_DATA}/datasetsExport ${TMP_NEW}/datasetsExport`
}

const makeScriptToDoYarnStuff = (
    TMP_NEW: string
) => `# Install dependencies, build assets and migrate
cd ${TMP_NEW}
yarn install --production --frozen-lockfile
yarn build
yarn migrate
yarn tsn algolia/configureAlgolia.ts`

const makeScriptToDoQueueStuffDoFileStuffDoAdminServerStuffDoBake = (
    NAME: string,
    ROOT_TMP: string,
    TMP_NEW: string,
    FINAL_TARGET: string
) => {
    const OLD_REPO_BACKUP = `${ROOT_TMP}/${NAME}-old`

    return `# Create deploy queue file writable by any user
touch .queue
chmod 0666 .queue

# Atomically swap the old and new versions
rm -rf ${OLD_REPO_BACKUP}
mv ${FINAL_TARGET} ${OLD_REPO_BACKUP} || true
mv ${TMP_NEW} ${FINAL_TARGET}

# Restart the admin
pm2 restart ${NAME}
pm2 stop ${NAME}-deploy-queue

# Static build to update the public frontend code
cd ${FINAL_TARGET}
yarn tsn deploy/bakeSite.ts`
}

const makeScriptToDeployToNetlifyDoQueue = (
    NAME: string,
    GIT_EMAIL: string,
    GIT_NAME: string,
    FINAL_TARGET: string
) => `cd ${FINAL_TARGET}
yarn tsn deploy/deploySite.ts "${GIT_EMAIL}" "${GIT_NAME}"
# Restart the deploy queue
pm2 start ${NAME}-deploy-queue`

main()
