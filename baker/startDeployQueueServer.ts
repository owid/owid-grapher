import fs from "fs-extra"
import Bugsnag from "@bugsnag/js"
import {
    DEPLOY_QUEUE_FILE_PATH,
    BUGSNAG_NODE_API_KEY,
} from "../settings/serverSettings.js"
import { deployIfQueueIsNotEmpty } from "./DeployUtils.js"
import * as db from "../db/db.js"
// Ensure db is cleaned up on PM2 stop / restart / reload and cmd/ctrl + c
// by registering listeners on SIGINT.
import "../db/cleanup.js"

// TODO: The deploy queue is largely obsolete with buildkite but it's not visible in the admin yet so for now this code is kept
const main = async () => {
    if (!fs.existsSync(DEPLOY_QUEUE_FILE_PATH)) {
        console.error(
            `No deploy queue file found in: ${DEPLOY_QUEUE_FILE_PATH}`
        )
        process.exit(1)
    }

    if (BUGSNAG_NODE_API_KEY) {
        Bugsnag.start({
            apiKey: BUGSNAG_NODE_API_KEY,
            context: "deploy-queue",
            autoTrackSessions: false,
        })
    }

    // Listen for file changes
    fs.watchFile(DEPLOY_QUEUE_FILE_PATH, () => {
        // Start deploy after 10 seconds in order to avoid the quick successive
        // deploys triggered by Wordpress.
        setTimeout(deployIfQueueIsNotEmpty, 10 * 1000)
    })

    // TODO: this transaction is only RW because somewhere inside it we fetch images
    await db.knexReadWriteTransaction(
        deployIfQueueIsNotEmpty,
        db.TransactionCloseMode.Close
    )
}

void main()
