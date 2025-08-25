// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../serverUtils/instrument.js"

import fs from "fs-extra"
import { DEPLOY_QUEUE_FILE_PATH } from "../settings/serverSettings.js"
import { deployIfQueueIsNotEmpty } from "./DeployUtils.js"
import * as db from "../db/db.js"
// Ensure db is cleaned up on PM2 stop / restart / reload and cmd/ctrl + c
// by registering listeners on SIGINT.
import "../db/cleanup.js"
import { logErrorAndMaybeCaptureInSentry } from "../serverUtils/errorLog.js"

const runDeployIfQueueIsNotEmpty = async () =>
    await db.knexReadonlyTransaction(
        deployIfQueueIsNotEmpty,
        db.TransactionCloseMode.KeepOpen
    )

// TODO: The deploy queue is largely obsolete with buildkite but it's not visible in the admin yet so for now this code is kept
const main = async () => {
    if (!fs.existsSync(DEPLOY_QUEUE_FILE_PATH)) {
        console.error(
            `No deploy queue file found in: ${DEPLOY_QUEUE_FILE_PATH}`
        )
        process.exit(1)
    }

    // Poll for changes every 5 seconds
    while (true) {
        try {
            await runDeployIfQueueIsNotEmpty()
        } catch (error) {
            await logErrorAndMaybeCaptureInSentry(error)
            throw error
        }
        await new Promise((resolve) => setTimeout(resolve, 5 * 1000))
    }
}

void main()
