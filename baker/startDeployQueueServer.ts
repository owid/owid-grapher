import * as fs from "fs-extra"
import { DEPLOY_QUEUE_FILE_PATH } from "../settings/serverSettings.js"
import { deployIfQueueIsNotEmpty } from "./DeployUtils.js"
import * as db from "../db/db.js"
// Ensure db is cleaned up on PM2 stop / restart / reload and cmd/ctrl + c
// by registering listeners on SIGINT.
import "../db/cleanup.js"

const main = async () => {
    if (!fs.existsSync(DEPLOY_QUEUE_FILE_PATH)) {
        console.error(
            `No deploy queue file found in: ${DEPLOY_QUEUE_FILE_PATH}`
        )
        process.exit(1)
    }

    await db.getConnection()

    // Listen for file changes
    fs.watchFile(DEPLOY_QUEUE_FILE_PATH, () => {
        // Start deploy after 10 seconds in order to avoid the quick successive
        // deploys triggered by Wordpress.
        setTimeout(deployIfQueueIsNotEmpty, 10 * 1000)
    })

    deployIfQueueIsNotEmpty()
}

main()
