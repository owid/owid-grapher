/*
 * The `yarn buildGdocsReferenceDoc` command line, run as a child process:
 * --dry-run works with no credentials (to stdout or one file per document),
 * and a missing folder id fails fast before any Google call.
 *
 * Run just this file:
 *     yarn test run --reporter dot devTools/gdocs/referenceDoc/cli.test.ts
 */

import { describe, expect, test } from "vitest"
import { spawnSync } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"
import componentsRegistry from "@ourworldindata/types/src/gdocTypes/components.registry.generated.json"
import templatesRegistry from "@ourworldindata/types/src/gdocTypes/templates.registry.generated.json"
import guidesRegistry from "@ourworldindata/types/src/gdocTypes/guides.registry.generated.json"

const ROOT = path.resolve(import.meta.dirname, "../../..")
const SCRIPT = "devTools/gdocs/buildGdocsReferenceDoc.ts"
const SETTING = "GDOCS_REFERENCE_FOLDER_ID"
const NO_CREDENTIALS = {
    GDOCS_CLIENT_EMAIL: "",
    GDOCS_PRIVATE_KEY: "",
    [SETTING]: "",
}
const ITEM_COUNT =
    componentsRegistry.components.length +
    templatesRegistry.length +
    guidesRegistry.length

function run(
    args: string[],
    env: Record<string, string> = {}
): { status: number | null; stdout: string; stderr: string } {
    const result = spawnSync(
        path.join(ROOT, "node_modules/.bin/tsx"),
        ["--tsconfig", "tsconfig.tsx.json", SCRIPT, ...args],
        {
            cwd: ROOT,
            encoding: "utf8",
            env: { ...process.env, ...env },
            // The --requests JSON for the whole library is over 1MB
            maxBuffer: 16 * 1024 * 1024,
        }
    )
    return {
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
    }
}

describe("buildGdocsReferenceDoc", () => {
    test("--dry-run prints every document as Markdown, the index first, and needs no credentials", () => {
        const result = run(["--dry-run"], NO_CREDENTIALS)
        expect(result.stderr).not.toContain("Error")
        expect(result.status).toBe(0)
        const h1s = result.stdout.match(/^# .*$/gm) ?? []
        expect(h1s[0]).toBe("# Writing reference for Google Docs")
        expect(h1s).toHaveLength(ITEM_COUNT + 1)
        // Documents are separated by a blank line before their H1
        expect(result.stdout).toMatch(/\n\n# Chart\n/)
    }, 60_000)

    test("--dry-run --out <dir> writes index.md plus one file per item, with no Markdown syntax outside fences", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gdocs-ref-"))
        try {
            const result = run(["--dry-run", "--out", dir], NO_CREDENTIALS)
            expect(result.status).toBe(0)
            expect(result.stdout).toBe("")
            const files = fs.readdirSync(dir).sort()
            expect(files).toHaveLength(ITEM_COUNT + 1)
            expect(files).toContain("index.md")
            expect(files).toContain("component-chart.md")
            expect(files).toContain("template-article.md")
            expect(files).toContain("guide-refs.md")
            const index = fs.readFileSync(path.join(dir, "index.md"), "utf8")
            expect(index.length).toBeLessThan(15_000)
            for (const file of files) {
                const outsideFences = fs
                    .readFileSync(path.join(dir, file), "utf8")
                    .split(/^```$/m)
                    .filter((_, i) => i % 2 === 0)
                    .join("\n")
                expect(outsideFences, file).not.toMatch(/`|\*\*|<!--/)
            }
        } finally {
            fs.rmSync(dir, { recursive: true, force: true })
        }
    }, 60_000)

    test("--dry-run --requests prints { title, chunks } per document with the tab id placeholder", () => {
        const result = run(["--dry-run", "--requests"], NO_CREDENTIALS)
        expect(result.status).toBe(0)
        const docs = JSON.parse(result.stdout) as {
            title: string
            chunks: unknown[][]
        }[]
        expect(docs).toHaveLength(ITEM_COUNT + 1)
        expect(docs[0].title).toBe("OWID writing reference — start here")
        expect(docs[0].chunks.length).toBeGreaterThan(0)
        expect(result.stdout).toContain('"tabId": "<tabId>"')
    }, 60_000)

    test("--requests or --out without --dry-run exit 1 before touching Google", () => {
        for (const args of [["--requests"], ["--out", "x"]]) {
            const result = run(args, { [SETTING]: "some-folder-id" })
            expect(result.status).toBe(1)
            expect(result.stderr).toContain("--dry-run")
        }
    }, 60_000)

    test("without the folder id it exits 1 naming the setting", () => {
        const result = run([], { [SETTING]: "" })
        expect(result.status).toBe(1)
        expect(result.stderr).toContain(`${SETTING} is not set`)
        // Nothing rendered (dotenv may print a tip line)
        expect(result.stdout).not.toContain("# Writing reference")
    }, 60_000)
})
