import * as fs from "fs-extra"
import { DEPLOY_QUEUE_FILE_PATH } from "serverSettings"

import { queueIsEmpty, triggerDeploy } from "./queue"

async function main() {
    // Listen for file changes
    fs.watchFile(DEPLOY_QUEUE_FILE_PATH, () => {
        // Start deploy after 10 seconds in order to avoid the quick successive
        // deploys triggered by Wordpress.
        setTimeout(triggerDeploy, 10 * 1000)
    })

    if (!(await queueIsEmpty())) {
        triggerDeploy()
    }
}

main()
