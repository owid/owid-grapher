import fs from "fs-extra"
import {
    renderTransactionalEmailTemplates,
    transactionalEmailTemplatePath,
} from "../baker/emailNotifications/transactionalEmailTemplates.js"

async function main(): Promise<void> {
    const templates = await renderTransactionalEmailTemplates()
    for (const [name, template] of Object.entries(templates)) {
        const file = transactionalEmailTemplatePath(name)
        await fs.outputFile(file, JSON.stringify(template, null, 4) + "\n")
        console.log(`Wrote ${file}`)
    }
}

void main()
