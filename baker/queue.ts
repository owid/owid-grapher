import { Deploy, DeployChange, DeployStatus } from "clientUtils/owidTypes"
import * as fs from "fs-extra"
import {
    DEPLOY_QUEUE_FILE_PATH,
    DEPLOY_PENDING_FILE_PATH,
} from "settings/serverSettings"

// File manipulation

const readQueuedFile = async () =>
    await fs.readFile(DEPLOY_QUEUE_FILE_PATH, "utf8")

const readPendingFile = async () => {
    if (await fs.pathExists(DEPLOY_PENDING_FILE_PATH))
        return await fs.readFile(DEPLOY_PENDING_FILE_PATH, "utf8")
    return undefined
}

export const readQueuedAndPendingFiles = async () => {
    const queueContent = await readQueuedFile()
    const pendingContent = await readPendingFile()
    // If any deploys didn't exit cleanly, DEPLOY_PENDING_FILE_PATH would exist.
    // Prepend that message to the current deploy.
    return pendingContent ? pendingContent + "\n" + queueContent : queueContent
}

export const enqueueChange = async (item: DeployChange) =>
    await fs.appendFile(DEPLOY_QUEUE_FILE_PATH, JSON.stringify(item) + "\n")

export const clearQueueFile = async () =>
    await fs.truncate(DEPLOY_QUEUE_FILE_PATH, 0)

export const writePendingFile = async (content: string) =>
    await fs.writeFile(DEPLOY_PENDING_FILE_PATH, content)

export const deletePendingFile = async () =>
    await fs.unlink(DEPLOY_PENDING_FILE_PATH)

// Parsing queue content

export const queueIsEmpty = async () => !(await readQueuedAndPendingFiles())

// Parse all lines in file as JSON
export const parseQueueContent = (content: string): DeployChange[] =>
    content
        .split("\n")
        .map((line) => {
            try {
                return JSON.parse(line)
            } catch (err) {
                return null
            }
        })
        .filter((x) => x)

export const getDeploys = async () => {
    const [queueContent, pendingContent] = await Promise.all([
        readQueuedFile(),
        readPendingFile(),
    ])
    const deploys: Deploy[] = []
    if (queueContent)
        deploys.push({
            status: DeployStatus.queued,
            // Changes are always appended. Reversing them means the latest changes are first
            // (which is what we want in the UI).
            // We can't sort by time because the presence of "time" is not guaranteed.
            changes: parseQueueContent(queueContent).reverse(),
        })
    if (pendingContent)
        deploys.push({
            status: DeployStatus.pending,
            changes: parseQueueContent(pendingContent).reverse(),
        })
    return deploys
}
