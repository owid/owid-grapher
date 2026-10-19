import fs from "fs-extra"
import { describe, expect, it } from "vitest"
import {
    renderTransactionalEmailTemplates,
    transactionalEmailTemplatePath,
} from "./transactionalEmailTemplates.js"

describe("transactional email templates", () => {
    it("are committed up to date (run yarn buildTransactionalEmailTemplates)", async () => {
        const templates = await renderTransactionalEmailTemplates()
        for (const [name, template] of Object.entries(templates)) {
            const committed = await fs.readJson(
                transactionalEmailTemplatePath(name)
            )
            expect(committed, name).toEqual(template)
        }
    })
})
