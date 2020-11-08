#! /usr/bin/env yarn tsn

import * as fs from "fs-extra"
import os from "os"
import * as path from "path"
import parseArgs from "minimist"
import * as prompts from "prompts"
import ProgressBar = require("progress")
import { exec } from "utils/server/serverUtil"
import {
    getGitBranchNameForDir,
    gitUserInfo,
    pullAndRebaseFromGit,
} from "gitCms/GitUtils"
import { spawn } from "child_process"

const runLiveSafetyChecks = async (dir: string) => {
    const branch = await getGitBranchNameForDir(dir)
    if (branch !== "master")
        printAndExit("To deploy to live please run from the master branch.")

    // Making sure we have the latest changes from the upstream
    // Also, will fail if working copy is not clean
    const result = await pullAndRebaseFromGit(dir)
    if (result.code !== 0) printAndExit(JSON.stringify(result))

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

    let HOST = ""
    if (stagingServers.has(NAME)) HOST = "owid@165.22.127.239"
    else if (NAME === LIVE_NAME) {
        HOST = "owid@209.97.185.49"
        await runLiveSafetyChecks(DIR)
    } else printAndExit("Please select either live or a valid test target.")

    const testSteps = !skipChecks && !runChecksRemotely ? 2 : 0
    const progressBar = new ProgressBar(
        ` Baking and deploying to ${NAME} [:bar] :current/:total :elapseds :name\n`,
        {
            complete: "=",
            incomplete: " ",
            width: 40,
            total: 6 + testSteps,
        }
    )

    progressBar.tick({ name: "✅ set params and run checks" })

    const ROOT = "/home/owid"
    const ROOT_TMP = `${ROOT}/tmp`
    const SYNC_TARGET = `${ROOT_TMP}/${NAME}-${USER}`
    const SYNC_TARGET_TESTS = `${ROOT_TMP}/${NAME}-tests`

    if (runChecksRemotely) {
        await runPreDeployChecksRemotely(DIR, HOST, SYNC_TARGET_TESTS)
        progressBar.tick({ name: "✅ runPreDeployChecksRemotely" })
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
    const gitInfo = await gitUserInfo(DIR)
    fs.writeFileSync(DIR + "/public/head.txt", gitInfo.head, "utf8")
    progressBar.tick({ name: "✅ write head.txt" })

    await ensureTmpDirExistsOnServer(HOST, ROOT_TMP)
    progressBar.tick({ name: `✅ ${ROOT_TMP} exists on ${HOST}` })

    const script = makeScriptToDoFileStuffDoYarnStuffDoAlgoliaStuffDoQueueStuffDoFileStuffDoAdminServerStuffDoBakeAndDeployToNetlifyDoQueue(
        ROOT,
        NAME,
        USER,
        DIR,
        SYNC_TARGET,
        HOST,
        ROOT_TMP,
        gitInfo.email,
        gitInfo.name
    )

    const tempScriptFilename = "temp_deploy_script.sh"
    const remoteScriptPath = `${SYNC_TARGET}/${tempScriptFilename}`
    const deployScriptPath = `${DIR}/${tempScriptFilename}`
    fs.writeFileSync(deployScriptPath, script, "utf8")
    fs.chmodSync(deployScriptPath, "755")

    await copyLocalRepoToServerTmpDirectory(HOST, DIR, SYNC_TARGET)
    progressBar.tick({
        name: `✅ ${DIR} repo rsynced to ${HOST} ${SYNC_TARGET}`,
    })

    console.log(`⏳ Running ${remoteScriptPath} on ${HOST}`)
    await runAndStreamScriptOnRemoteServerViaSSH(HOST, remoteScriptPath)
    progressBar.tick({
        name:
            "✅ ranScriptToDoFileStuffDoYarnStuffDoAlgoliaStuffDoQueueStuffDoFileStuffDoAdminServerStuffDoBakeAndDeployToNetlifyDoQueue",
    })
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

    for await (const chunk of child.stdout) {
        console.log(chunk.toString())
    }
    for await (const chunk of child.stderr) {
        console.error(chunk.toString())
    }
    const exitCode = await new Promise((resolve, reject) => {
        child.on("close", resolve)
    })

    if (exitCode) {
        console.log(`Exit code: ${exitCode}`)
    }
}

const makeScriptToDoFileStuffDoYarnStuffDoAlgoliaStuffDoQueueStuffDoFileStuffDoAdminServerStuffDoBakeAndDeployToNetlifyDoQueue = (
    ROOT: string,
    NAME: string,
    USER: string,
    DIR: string,
    SYNC_TARGET: string,
    HOST: string,
    ROOT_TMP: string,
    GIT_EMAIL: string,
    GIT_NAME: string
) => {
    const OLD_REPO_BACKUP = `${ROOT_TMP}/${NAME}-old`
    const TMP_NEW = `${ROOT_TMP}/${NAME}-${USER}-tmp`
    const FINAL_TARGET = `${ROOT}/${NAME}`
    const FINAL_DATA = `${ROOT}/${NAME}-data`

    const script = `# Remove any previous temporary repo
rm -rf ${TMP_NEW}

# Copy the synced repo-- this is because we're about to move it, and we want the
# original target to stay around to make future syncs faster
cp -r ${SYNC_TARGET} ${TMP_NEW}

# Link in all the persistent stuff that needs to stay around between versions
ln -sf ${FINAL_DATA}/.env ${TMP_NEW}/.env
mkdir -p ${FINAL_DATA}/bakedSite
ln -sf ${FINAL_DATA}/bakedSite ${TMP_NEW}/bakedSite
mkdir -p ${FINAL_DATA}/datasetsExport
ln -sf ${FINAL_DATA}/datasetsExport ${TMP_NEW}/datasetsExport

# Install dependencies, build assets and migrate
cd ${TMP_NEW}
yarn install --production --frozen-lockfile
yarn build
yarn migrate
yarn tsn algolia/configureAlgolia.ts

# Create deploy queue file writable by any user
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
yarn tsn deploy/bakeAndDeploySite.ts "${GIT_EMAIL}" "${GIT_NAME}"

# Restart the deploy queue
pm2 start ${NAME}-deploy-queue`
    return script
}

main()
