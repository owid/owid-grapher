import * as fs from "fs-extra"
import { DEPLOY_QUEUE_FILE_PATH } from "../adminSiteServer/utils/node_modules/serverSettings"
import { deployIfQueueIsNotEmpty } from "./DeployUtils"

async function main() {
    // Listen for file changes
    fs.watchFile(DEPLOY_QUEUE_FILE_PATH, () => {
        // Start deploy after 10 seconds in order to avoid the quick successive
        // deploys triggered by Wordpress.
        setTimeout(deployIfQueueIsNotEmpty, 10 * 1000)
    })

    deployIfQueueIsNotEmpty()
}

main()
