import * as fs from "fs-extra"
import {
    DEPLOY_QUEUE_FILE_PATH,
    DEPLOY_PENDING_FILE_PATH,
} from "../adminSiteServer/utils/node_modules/serverSettings"
import { DeployChange, Deploy, DeployStatus } from "./types"

// File manipulation

async function readQueuedFile(): Promise<string> {
    return await fs.readFile(DEPLOY_QUEUE_FILE_PATH, "utf8")
}

async function readPendingFile(): Promise<string | undefined> {
    if (await fs.pathExists(DEPLOY_PENDING_FILE_PATH)) {
        return await fs.readFile(DEPLOY_PENDING_FILE_PATH, "utf8")
    }
    return undefined
}

export async function readQueuedAndPendingFiles(): Promise<string> {
    const queueContent = await readQueuedFile()
    const pendingContent = await readPendingFile()
    // If any deploys didn't exit cleanly, DEPLOY_PENDING_FILE_PATH would exist.
    // Prepend that message to the current deploy.
    if (pendingContent) {
        return pendingContent + "\n" + queueContent
    } else {
        return queueContent
    }
}

export async function enqueueChange(item: DeployChange) {
    await fs.appendFile(DEPLOY_QUEUE_FILE_PATH, JSON.stringify(item) + "\n")
}

export async function clearQueueFile() {
    await fs.truncate(DEPLOY_QUEUE_FILE_PATH, 0)
}

export async function writePendingFile(content: string) {
    await fs.writeFile(DEPLOY_PENDING_FILE_PATH, content)
}

export async function deletePendingFile() {
    await fs.unlink(DEPLOY_PENDING_FILE_PATH)
}

// Parsing queue content

export async function queueIsEmpty(): Promise<boolean> {
    return !(await readQueuedAndPendingFiles())
}

export function parseQueueContent(content: string): DeployChange[] {
    // Parse all lines in file as JSON
    return content
        .split("\n")
        .map((line) => {
            try {
                return JSON.parse(line)
            } catch (err) {
                return null
            }
        })
        .filter((x) => x)
}

export async function getDeploys(): Promise<Deploy[]> {
    const [queueContent, pendingContent] = await Promise.all([
        readQueuedFile(),
        readPendingFile(),
    ])
    const deploys: Deploy[] = []
    if (queueContent) {
        deploys.push({
            status: DeployStatus.queued,
            // Changes are always appended. Reversing them means the latest changes are first
            // (which is what we want in the UI).
            // We can't sort by time because the presence of "time" is not guaranteed.
            changes: parseQueueContent(queueContent).reverse(),
        })
    }
    if (pendingContent) {
        deploys.push({
            status: DeployStatus.pending,
            changes: parseQueueContent(pendingContent).reverse(),
        })
    }
    return deploys
}
