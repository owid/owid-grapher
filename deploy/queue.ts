import * as fs from "fs-extra"
import {
    DEPLOY_QUEUE_FILE_PATH,
    DEPLOY_PENDING_FILE_PATH,
} from "serverSettings"
import { deploy } from "./deploy"
import { DeployChange, Deploy, DeployStatus } from "./types"

const MAX_SUCCESSIVE_FAILURES = 2

/** Whether a deploy is currently running (global variable) */
let deploying: boolean = false

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

async function readQueuedAndPendingFiles(): Promise<string> {
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

export async function enqueueDeploy(item: DeployChange) {
    await fs.appendFile(DEPLOY_QUEUE_FILE_PATH, JSON.stringify(item) + "\n")
}

async function clearQueueFile() {
    await fs.truncate(DEPLOY_QUEUE_FILE_PATH, 0)
}

// Parsing queue content

export async function queueIsEmpty(): Promise<boolean> {
    return !(await readQueuedAndPendingFiles())
}

function parseContent(content: string): DeployChange[] {
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
        .filter(x => x)
}

function generateCommitMsg(queueItems: DeployChange[]): string {
    const date: string = new Date().toISOString()

    const message: string = queueItems
        .filter((item) => item.message)
        .map((item) => item.message)
        .join("\n")

    const coauthors: string = queueItems
        .filter((item) => item.authorName)
        .map((item) => {
            return `Co-authored-by: ${item.authorName} <${item.authorEmail}>`
        })
        .join("\n")

    return `Deploy ${date}\n${message}\n\n\n${coauthors}`
}

export async function getDeploys(): Promise<Deploy[]> {
    const [queueContent, pendingContent] = await Promise.all([
        readQueuedFile(),
        readPendingFile()
    ])
    const deploys: Deploy[] = []
    if (queueContent) {
        deploys.push({
            status: DeployStatus.queued,
            changes: parseContent(queueContent)
        })
    }
    if (pendingContent) {
        deploys.push({
            status: DeployStatus.pending,
            changes: parseContent(pendingContent)
        })
    }
    return deploys
}

export async function triggerDeploy() {
    if (!deploying) {
        deploying = true
        let failures = 0
        while (!(await queueIsEmpty()) && failures < MAX_SUCCESSIVE_FAILURES) {
            const deployContent = await readQueuedAndPendingFiles()
            // Truncate file immediately. Ideally this would be an atomic action, otherwise it's
            // possible that another process writes to this file in the meantime...
            await clearQueueFile()
            // Write to `.deploying` file to be able to recover the deploy message
            // in case of failure.
            await fs.writeFile(DEPLOY_PENDING_FILE_PATH, deployContent)
            const message = generateCommitMsg(parseContent(deployContent))
            console.log(`Deploying site...\n---\n${message}\n---`)
            try {
                await deploy(message)
                await fs.unlink(DEPLOY_PENDING_FILE_PATH)
            } catch (err) {
                failures++
                // The error is already sent to Slack inside the deploy() function.
                // The deploy will be retried unless we've reached MAX_SUCCESSIVE_FAILURES.
            }
        }
        deploying = false
    }
}
