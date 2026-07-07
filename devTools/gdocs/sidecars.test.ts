/*
 * Asserts every member of the OwidEnrichedGdocBlock union has a sibling .md
 * sidecar in archieMLComponents/. Runs as part of the normal test suite.
 *
 * Run just this file:
 *     yarn test run --reporter dot devTools/gdocs/sidecars.test.ts
 *
 * The companion script that regenerates docs/ from those sidecars is
 * devTools/gdocs/generate-gdocs-references.ts.
 */

import { describe, expect, test } from "vitest"
import fs from "node:fs"
import path from "node:path"
import {
    ALL_GDOC_TYPES,
    getContentKeysForGdocType,
} from "@ourworldindata/types"

const REPO_ROOT = path.resolve(__dirname, "../..")
const COMPONENTS_DIR = path.join(
    REPO_ROOT,
    "packages/@ourworldindata/types/src/gdocTypes/archieMLComponents"
)
const ARCHIE_ML_COMPONENTS = path.join(
    REPO_ROOT,
    "packages/@ourworldindata/types/src/gdocTypes/ArchieMlComponents.ts"
)
const TEMPLATES_DIR = path.join(
    REPO_ROOT,
    "packages/@ourworldindata/types/src/gdocTypes/templates"
)

function unionMemberNames(): string[] {
    const text = fs.readFileSync(ARCHIE_ML_COMPONENTS, "utf-8")
    const match =
        /export type OwidEnrichedGdocBlock\s*=([\s\S]+?)(?=\n\n|\nexport )/.exec(
            text
        )
    if (!match) throw new Error("Could not find OwidEnrichedGdocBlock union")
    const seen = new Set<string>()
    const names: string[] = []
    for (const raw of match[1].split("|")) {
        const trimmed = raw.trim()
        if (!/^EnrichedBlock\w+$/.test(trimmed)) continue
        if (seen.has(trimmed)) continue
        seen.add(trimmed)
        names.push(trimmed)
    }
    return names
}

describe("archieML component sidecars", () => {
    for (const name of unionMemberNames()) {
        test(name + " has a sidecar .md", () => {
            const sidecar = path.join(
                COMPONENTS_DIR,
                name.replace(/^EnrichedBlock/, "") + ".md"
            )
            expect(
                fs.existsSync(sidecar),
                "Missing sidecar at " + sidecar
            ).toBe(true)
        })
    }
})

describe("gdoc template sidecars", () => {
    const writableTypes = ALL_GDOC_TYPES.filter((type) =>
        getContentKeysForGdocType(type)
    )
    for (const type of writableTypes) {
        test(type + " has a template sidecar .md", () => {
            const pascal = type
                .split("-")
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                .join("")
            const sidecar = path.join(TEMPLATES_DIR, pascal + ".md")
            expect(
                fs.existsSync(sidecar),
                "Missing template sidecar at " + sidecar
            ).toBe(true)
        })
    }

    for (const interfaceName of [
        "OwidGdocPostContent",
        "OwidGdocDataInsightContent",
    ]) {
        test(interfaceName + " has a field descriptions .md", () => {
            const fieldsFile = path.join(TEMPLATES_DIR, interfaceName + ".md")
            expect(
                fs.existsSync(fieldsFile),
                "Missing field descriptions at " + fieldsFile
            ).toBe(true)
        })
    }
})
