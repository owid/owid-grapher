import { DeployQueueServer } from "./DeployQueueServer.js"
import {
    BAKED_SITE_DIR,
    BAKED_BASE_URL,
    BUILDKITE_API_ACCESS_TOKEN,
} from "../settings/serverSettings.js"
import { SiteBaker } from "../baker/SiteBaker.js"
import { DeployChange, DeployMetadata } from "@ourworldindata/utils"
import { KnexReadonlyTransaction } from "../db/db.js"
import {
    getChangesAuthorNames,
    getDeployMetadata,
    triggerBuildkiteDeploy,
} from "./BuildkiteDeployUtils.js"

const deployQueueServer = new DeployQueueServer()

/**
 * Initiate a deploy, without any checks. Throws error on failure.
 */

const triggerBakeAndDeploy = async (
    deployMetadata: DeployMetadata,
    knex: KnexReadonlyTransaction,
    lightningQueue?: DeployChange[]
) => {
    // deploy to Buildkite if we're on master and BUILDKITE_API_ACCESS_TOKEN is set
    if (BUILDKITE_API_ACCESS_TOKEN) {
        const queueItems = lightningQueue ?? [{ message: deployMetadata.title }]
        await triggerBuildkiteDeploy(queueItems)
    } else {
        // otherwise, bake locally. This is used for local development or staging servers
        const baker = new SiteBaker(BAKED_SITE_DIR, BAKED_BASE_URL)
        if (lightningQueue?.length) {
            if (!lightningQueue.every((change) => change.slug))
                throw new Error("Lightning deploy is missing a slug")

            await baker.bakeGDocPosts(
                knex,
                lightningQueue.map((c) => c.slug!)
            )
        } else {
            await baker.bakeAll(knex)
        }
    }
}

/**
 * Initiate deploy if no other deploy is currently pending, and there are changes
 * in the queue.
 * If there is a deploy pending, another one will be automatically triggered at
 * the end of the current one, as long as there are changes in the queue.
 * If there are no changes in the queue, a deploy won't be initiated.
 */
export const deployIfQueueIsNotEmpty = async (
    knex: KnexReadonlyTransaction
) => {
    if (BUILDKITE_API_ACCESS_TOKEN) return

    if (!(await deployQueueServer.queueIsEmpty())) {
        const deployContent =
            await deployQueueServer.readQueuedAndPendingFiles()
        // Truncate file immediately. Ideally this would be an atomic action, otherwise it's
        // possible that another process writes to this file in the meantime...
        await deployQueueServer.clearQueueFile()
        // Write to `.pending` file to be able to recover the deploy message
        // in case of failure.
        await deployQueueServer.writePendingFile(deployContent)

        const parsedQueue = deployQueueServer.parseQueueContent(deployContent)

        // Log the changes that are about to be deployed in a text format.
        const dateStr: string = new Date().toISOString()
        const changesAuthorNames = getChangesAuthorNames(parsedQueue)
        console.log(
            `Deploying site...\n---\n📆 ${dateStr}\n\n${changesAuthorNames.join(
                "\n"
            )}\n---`
        )

        await triggerBakeAndDeploy(
            await getDeployMetadata(parsedQueue),
            knex,
            // If every DeployChange is a lightning change, then we can do a
            // lightning deploy. In the future, we might want to separate
            // lightning updates from regular deploys so we could prioritize
            // them, no matter the content of the queue.
            parsedQueue.every(isLightningChange) ? parsedQueue : undefined
        )
        await deployQueueServer.deletePendingFile()
    }
}

const isLightningChange = (item: DeployChange) => item.slug
