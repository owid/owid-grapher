import * as fs from "fs-extra"
import {
    DEPLOY_QUEUE_FILE_PATH,
    DEPLOY_PENDING_FILE_PATH,
} from "serverSettings"
import { deploy } from "./deploy"
import { DeployChange, Deploy, DeployStatus } from "./types"

const MAX_SUCCESSIVE_FAILURES = 2

let deploying = false

function identity(x: any) {
    return x
}

async function readQueueContent(): Promise<string> {
    return await fs.readFile(DEPLOY_QUEUE_FILE_PATH, "utf8")
}

async function readPendingContent(): Promise<string | undefined> {
    if (fs.existsSync(DEPLOY_PENDING_FILE_PATH)) {
        return await fs.readFile(DEPLOY_PENDING_FILE_PATH, "utf8")
    }
    return undefined
}

async function readQueueAndPendingContent(): Promise<string> {
    const queueContent = await readQueueContent()
    const pendingContent = await readPendingContent()
    // If any deploys didn't exit cleanly, DEPLOY_PENDING_FILE_PATH would exist.
    // Prepend that message to the current deploy.
    if (pendingContent) {
        return pendingContent + "\n" + queueContent
    } else {
        return queueContent
    }
}

export async function getDeploys(): Promise<Deploy[]> {
    const [queueContent, pendingContent] = await Promise.all([
        readQueueContent(),
        readPendingContent()
    ])
    const deploys: Deploy[] = []
    if (queueContent) {
        deploys.push({
            status: DeployStatus.queued,
            changes: parseQueueContent(queueContent)
        })
    }
    if (pendingContent) {
        deploys.push({
            status: DeployStatus.pending,
            changes: parseQueueContent(pendingContent)
        })
    }
    return deploys
}

export async function enqueueDeploy(item: DeployChange) {
    await fs.appendFile(DEPLOY_QUEUE_FILE_PATH, JSON.stringify(item) + "\n")
}

async function eraseQueueContent() {
    await fs.truncate(DEPLOY_QUEUE_FILE_PATH, 0)
}

export async function queueIsEmpty(): Promise<boolean> {
    return !(await readQueueAndPendingContent())
}

async function pullQueueContent(): Promise<string> {
    // Read line-delimited JSON
    const queueContent = await readQueueAndPendingContent()

    // Truncate file immediately. It's still somewhat possible that another process
    // writes to this file in the meantime...
    await eraseQueueContent()

    return queueContent
}

function parseQueueContent(content: string): DeployChange[] {
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
        .filter(identity)
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

export async function triggerDeploy() {
    if (!deploying) {
        deploying = true
        let failures = 0
        while (!(await queueIsEmpty()) && failures < MAX_SUCCESSIVE_FAILURES) {
            const deployContent = await pullQueueContent()
            // Write to `.deploying` file to be able to recover the deploy message
            // in case of failure.
            await fs.writeFile(DEPLOY_PENDING_FILE_PATH, deployContent)
            const message = generateCommitMsg(parseQueueContent(deployContent))
            console.log(`Deploying site...\n---\n${message}\n---`)
            try {
                await deploy(message)
                await fs.unlink(DEPLOY_PENDING_FILE_PATH)
            } catch (err) {
                failures++
                // The error will be logged and sent to Slack.
                // The deploy will be retried unless we've reached MAX_SUCCESSIVE_FAILURES.
            }
        }
        deploying = false
    }
}
