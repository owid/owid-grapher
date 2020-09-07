import * as fs from "fs-extra"
import {
    DEPLOY_QUEUE_FILE_PATH,
    DEPLOY_PENDING_FILE_PATH,
} from "serverSettings"
import { deploy } from "./deploy"

const MAX_SUCCESSIVE_FAILURES = 2

let deploying = false

function identity(x: any) {
    return x
}

interface IDeployQueueItem {
    authorName?: string
    authorEmail?: string
    message?: string
}

async function readQueueContent(): Promise<string> {
    const queueContent = await fs.readFile(DEPLOY_QUEUE_FILE_PATH, "utf8")
    // If any deploys didn't exit cleanly, DEPLOY_PENDING_FILE_PATH would exist.
    // Prepend that message to the current deploy.
    if (fs.existsSync(DEPLOY_PENDING_FILE_PATH)) {
        const deployingContent = await fs.readFile(
            DEPLOY_PENDING_FILE_PATH,
            "utf8"
        )
        return deployingContent + "\n" + queueContent
    } else {
        return queueContent
    }
}

export async function enqueueDeploy(item: IDeployQueueItem) {
    await fs.appendFile(DEPLOY_QUEUE_FILE_PATH, JSON.stringify(item) + "\n")
}

async function eraseQueueContent() {
    await fs.truncate(DEPLOY_QUEUE_FILE_PATH, 0)
}

export async function queueIsEmpty(): Promise<boolean> {
    return !(await readQueueContent())
}

async function pullQueueContent(): Promise<string> {
    // Read line-delimited JSON
    const queueContent = await readQueueContent()

    // Truncate file immediately. It's still somewhat possible that another process
    // writes to this file in the meantime...
    await eraseQueueContent()

    return queueContent
}

function parseQueueContent(content: string): IDeployQueueItem[] {
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

function generateCommitMsg(queueItems: IDeployQueueItem[]): string {
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
