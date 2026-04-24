import { vi } from "vitest"
import path from "path"
import fs from "fs"
import findProjectBaseDir from "../../settings/findBaseDir.js"

// Ensure Google Docs API calls read from local test-files fixtures
const baseDir = findProjectBaseDir(__dirname)
if (!baseDir) throw Error("Could not find project base directory")

vi.mock(import("@googleapis/docs"), async (importOriginal) => {
    const originalModule = await importOriginal()
    return {
        ...originalModule,
        docs: vi.fn(() => ({
            documents: {
                get: vi.fn(({ documentId }) => {
                    const unparsed = fs.readFileSync(
                        path.join(
                            baseDir,
                            "adminSiteServer",
                            "test-files",
                            `${documentId}.json`
                        ),
                        "utf8"
                    )
                    const data = JSON.parse(unparsed)
                    return Promise.resolve(data)
                }),
            },
        })),
    } as any
})
