import { Deploy, DeployChange, DeployStatus } from "../clientUtils/owidTypes.js"
import fs from "fs-extra"
import {
    DEPLOY_QUEUE_FILE_PATH,
    DEPLOY_PENDING_FILE_PATH,
} from "../settings/serverSettings.js"

export class DeployQueueServer {
    constructor(
        queueFilePath = DEPLOY_QUEUE_FILE_PATH,
        pendingFilePath = DEPLOY_PENDING_FILE_PATH
    ) {
        this.queueFilePath = queueFilePath
        this.pendingFilePath = pendingFilePath
    }

    private queueFilePath: string
    private pendingFilePath: string

    // File manipulation

    private async readQueuedFile() {
        return await fs.readFile(this.queueFilePath, "utf8")
    }

    private async readPendingFile() {
        if (await fs.pathExists(this.pendingFilePath))
            return await fs.readFile(this.pendingFilePath, "utf8")
        return undefined
    }

    async readQueuedAndPendingFiles() {
        const queueContent = await this.readQueuedFile()
        const pendingContent = await this.readPendingFile()
        // If any deploys didn't exit cleanly, this.pendingFilePath would exist.
        // Prepend that message to the current deploy.
        return pendingContent
            ? pendingContent + "\n" + queueContent
            : queueContent
    }

    async enqueueChange(item: DeployChange) {
        await fs.appendFile(this.queueFilePath, JSON.stringify(item) + "\n")
    }

    async clearQueueFile() {
        await fs.truncate(this.queueFilePath, 0)
    }

    async writePendingFile(content: string) {
        await fs.writeFile(this.pendingFilePath, content)
    }

    async deletePendingFile() {
        await fs.unlink(this.pendingFilePath)
    }

    // Parsing queue content
    async queueIsEmpty() {
        const res = await this.readQueuedAndPendingFiles()
        return !res
    }

    // Parse all lines in file as JSON
    parseQueueContent(content: string): DeployChange[] {
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

    async getDeploys() {
        const [queueContent, pendingContent] = await Promise.all([
            this.readQueuedFile(),
            this.readPendingFile(),
        ])
        const deploys: Deploy[] = []
        if (queueContent)
            deploys.push({
                status: DeployStatus.queued,
                // Changes are always appended. Reversing them means the latest changes are first
                // (which is what we want in the UI).
                // We can't sort by time because the presence of "time" is not guaranteed.
                changes: this.parseQueueContent(queueContent).reverse(),
            })
        if (pendingContent)
            deploys.push({
                status: DeployStatus.pending,
                changes: this.parseQueueContent(pendingContent).reverse(),
            })
        return deploys
    }
}
