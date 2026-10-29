// Smoke tests for the build outputs in dist/: is the bundle importable, does
// it export the public API, is it fully self-contained (no imports left), and
// does the built code actually run the ArchieML -> enriched blocks pipeline?
//
// Requires `yarn build` to have run first; execute via `yarn testPackage`.

import * as path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { beforeAll, describe, expect, it } from "vitest"
import {
    assertFilesExist,
    readImportSpecifiers,
    // oxlint-disable-next-line import-x-js/no-relative-packages
} from "../../packageTest-common.mts"

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const distDir = path.join(pkgDir, "dist")

const npmBuildPath = path.join(distDir, "gdoc-pipeline.js")
const dtsPath = path.join(distDir, "gdoc-pipeline.d.ts")

const PUBLIC_EXPORTS = [
    "gdocToArchie",
    "archieToEnriched",
    "parseRawBlocksToEnrichedBlocks",
    "enrichedBlockToRawBlock",
    "OwidRawGdocBlockToArchieMLString",
    "enrichedBlocksToMarkdown",
    "enrichedBlocksToIndexableText",
    "htmlToSpans",
    // re-exported from the workspace packages, which aren't published
    // individually — consumers can only get these through this package
    "traverseEnrichedBlock",
    "convertHeadingTextToId",
]

beforeAll(() => {
    assertFilesExist(pkgDir, [npmBuildPath, dtsPath], "`yarn build`")
})

describe("dist/gdoc-pipeline.js", () => {
    it("is fully self-contained (bundles all runtime dependencies)", async () => {
        // The published package declares no runtime dependencies, so the
        // bundle must not import anything. This also catches treeshaking
        // regressions: react, react-dom, mobx and @sentry/* are configured as
        // externals in tsdown.config.ts, so if code from the bundled
        // workspace packages that uses them ever stops being treeshaken away,
        // it shows up here as an import instead of silently bloating the
        // bundle.
        expect([...(await readImportSpecifiers(npmBuildPath))]).toEqual([])
    })

    it("exports the public API and runs the pipeline end-to-end", async () => {
        const mod = (await import(pathToFileURL(npmBuildPath).href)) as Record<
            string,
            unknown
        >

        for (const name of PUBLIC_EXPORTS) {
            expect(typeof mod[name], `export ${name}`).toBe("function")
        }

        // ArchieML -> enriched blocks
        const archieToEnriched = mod.archieToEnriched as (text: string) => {
            title?: string
            body?: unknown[]
        }
        const enriched = archieToEnriched(
            [
                "title: Smoke test",
                "[+body]",
                "Hello <b>world</b>",
                "{.horizontal-rule}",
                "{}",
                "[]",
            ].join("\n")
        )
        expect(enriched.title).toBe("Smoke test")
        expect(enriched.body).toHaveLength(2)

        // enriched blocks -> markdown
        const enrichedBlocksToMarkdown = mod.enrichedBlocksToMarkdown as (
            blocks: unknown[],
            exportComponents: boolean
        ) => string | undefined
        const markdown = enrichedBlocksToMarkdown(
            enriched.body as unknown[],
            false
        )
        expect(markdown).toContain("Hello **world**")
    })
})
