import * as path from 'path'
import * as fs from 'fs-extra'
import { SiteBaker } from 'site/server/SiteBaker'
import { log } from 'utils/server/log'
import { QUEUE_FILE_PATH, DEPLOYING_FILE_PATH } from 'serverSettings'

let deploying = false

function identity(x: any) {
    return x
}

interface IQueueItem {
    authorName?: string
    authorEmail?: string
    message?: string
}

async function readQueueContent(): Promise<string> {
    const queueContent = await fs.readFile(QUEUE_FILE_PATH, 'utf8')
    // If any deploys didn't exit cleanly, DEPLOYING_FILE_PATH would exist.
    // Prepend that message to the current deploy.
    if (!deploying && fs.existsSync(DEPLOYING_FILE_PATH)) {
        const deployingContent = await fs.readFile(DEPLOYING_FILE_PATH, 'utf8')
        return deployingContent + '\n' + queueContent
    } else {
        return queueContent
    }
}

async function eraseQueueContent() {
    await fs.truncate(QUEUE_FILE_PATH, 0)
}

async function queueIsEmpty(): Promise<boolean> {
    return !await readQueueContent()
}

async function pullQueueContent(): Promise<string> {
    // Read line-delimited JSON
    const queueContent = await readQueueContent()

    // Truncate file immediately. It's still somewhat possible that another process
    // writes to this file in the meantime...
    await eraseQueueContent()

    return queueContent
}

function parseQueueContent(content: string): IQueueItem[] {
    // Parse all lines in file as JSON
    return content
        .split('\n')
        .map((line) => {
            try {
                return JSON.parse(line)
            } catch (err) {
                return null
            }
        })
        .filter(identity)
}

function generateMessage(queueItems: IQueueItem[]): string {
    const date: string = (new Date()).toISOString()

    const message: string = queueItems
        .filter((item) => item.message)
        .map((item) => item.message)
        .join('\n')

    const coauthors: string = queueItems
        .filter((item) => item.authorName)
        .map((item) => {
            return `Co-authored-by: ${item.authorName} <${item.authorEmail}>`
        })
        .join('\n')

    return `Deploy ${date}\n${message}\n\n\n${coauthors}`
}

async function scheduleDeploy() {
    if (!deploying) {
        deploying = true
        while (!await queueIsEmpty()) {
            const deployContent = await pullQueueContent()
            // Write to `.deploying` file to be able to recover the deploy message
            // in case of failure.
            await fs.writeFile(DEPLOYING_FILE_PATH, deployContent)
            const message = generateMessage(parseQueueContent(deployContent))
            await deploy(message)
            await fs.unlink(DEPLOYING_FILE_PATH)
        }
        deploying = false
    }
}

async function deploy(message: string) {
    const baker = new SiteBaker({})

    try {
        console.log("Starting deploy...")
        await baker.bakeAll()
        await baker.deploy(message)
        console.log("Deploy finished.")
    } catch (err) {
        log.error(err)
    } finally {
        baker.end()
    }
}

async function main() {
    // Listen for file changes
    fs.watchFile(QUEUE_FILE_PATH, () => {
        console.log(`File changed: ${QUEUE_FILE_PATH}`)
        // Start deploy after 10 seconds in order to avoid the quick successive
        // deploys triggered by Wordpress.
        setTimeout(scheduleDeploy, 10*1000)
    })

    if (!await queueIsEmpty()) {
        scheduleDeploy()
    }
}

main()
