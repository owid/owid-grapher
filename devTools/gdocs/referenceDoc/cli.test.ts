/*
 * The `yarn buildGdocsReferenceDoc` command line, run as a child process:
 * --dry-run works with no credentials, and a missing document id fails fast
 * before any Google call.
 *
 * Run just this file:
 *     yarn test run --reporter dot devTools/gdocs/referenceDoc/cli.test.ts
 */

import { describe, expect, test } from "vitest"
import { spawnSync } from "child_process"
import path from "path"

const ROOT = path.resolve(import.meta.dirname, "../../..")
const SCRIPT = "devTools/gdocs/buildGdocsReferenceDoc.ts"
const SETTING = "GDOCS_REFERENCE_DOCUMENT_ID"

function run(
    args: string[],
    env: Record<string, string> = {}
): { status: number | null; stdout: string; stderr: string } {
    const result = spawnSync(
        path.join(ROOT, "node_modules/.bin/tsx"),
        ["--tsconfig", "tsconfig.tsx.json", SCRIPT, ...args],
        { cwd: ROOT, encoding: "utf8", env: { ...process.env, ...env } }
    )
    return {
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
    }
}

describe("buildGdocsReferenceDoc", () => {
    test("--dry-run prints Markdown with the four sections and needs no credentials", () => {
        const result = run(["--dry-run"], {
            GDOCS_CLIENT_EMAIL: "",
            GDOCS_PRIVATE_KEY: "",
            [SETTING]: "",
        })
        expect(result.stderr).not.toContain("Error")
        expect(result.status).toBe(0)
        expect(result.stdout.match(/^# .*$/gm)).toEqual([
            "# Overview",
            "# Guides",
            "# Templates",
            "# Components",
        ])
    }, 60_000)

    test("--dry-run --requests prints request chunks with the tab id placeholder", () => {
        const result = run(["--dry-run", "--requests"], { [SETTING]: "" })
        expect(result.status).toBe(0)
        const chunks = JSON.parse(result.stdout) as unknown[][]
        expect(chunks.length).toBeGreaterThan(0)
        expect(result.stdout).toContain('"tabId": "<tabId>"')
    }, 60_000)

    test("--requests or --out without --dry-run exit 1 before touching the doc", () => {
        for (const args of [["--requests"], ["--out", "x.md"]]) {
            const result = run(args, { [SETTING]: "some-doc-id" })
            expect(result.status).toBe(1)
            expect(result.stderr).toContain("--dry-run")
        }
    }, 60_000)

    test("without the document id it exits 1 naming the setting", () => {
        const result = run([], { [SETTING]: "" })
        expect(result.status).toBe(1)
        expect(result.stderr).toContain(`${SETTING} is not set`)
        // Nothing rendered (dotenv may print a tip line)
        expect(result.stdout).not.toContain("# Overview")
    }, 60_000)
})
