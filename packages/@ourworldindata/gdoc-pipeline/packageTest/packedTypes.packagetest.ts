// Typechecks the packed package from an external consumer project; see
// describePackedPackage for what exactly is checked.
//
// Requires `yarn build` and `yarn testPackage:pack` to have run first;
// execute via `yarn testPackage` (or just this vitest part via
// `yarn testPackage:vitest`).

import * as path from "node:path"
import { fileURLToPath } from "node:url"
// oxlint-disable-next-line import-x-js/no-relative-packages
import { describePackedPackage } from "../../packageTest-common.mts"

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

// Exercises the public API surface, incl. @ts-expect-error guards that the
// types didn't collapse to `any`.
const CONSUMER_SOURCE = `import {
    archieToEnriched,
    enrichedBlockToRawBlock,
    enrichedBlocksToMarkdown,
    gdocToArchie,
    htmlToSpans,
    traverseEnrichedBlock,
    OwidRawGdocBlockToArchieMLString,
    type OwidEnrichedGdocBlock,
    type OwidGdocPostContent,
    type OwidRawGdocBlock,
    type Span,
} from "@ourworldindata/gdoc-pipeline"

const content: OwidGdocPostContent = archieToEnriched("title: Smoke test")
const body: OwidEnrichedGdocBlock[] = content.body ?? []
for (const block of body) {
    traverseEnrichedBlock(block, (b) => void b)
    const raw: OwidRawGdocBlock = enrichedBlockToRawBlock(block)
    const archie: string = OwidRawGdocBlockToArchieMLString(raw)
    void archie
}
const markdown: string | undefined = enrichedBlocksToMarkdown(body, false)
void markdown

const spans: Span[] = htmlToSpans("Hello <b>world</b>")
void spans

// gdocToArchie consumes the Google Docs API document JSON
const archiePromise: Promise<{ text: string }> = gdocToArchie({
    title: "Doc",
    body: { content: [] },
})
void archiePromise

// @ts-expect-error archieToEnriched requires a string
archieToEnriched(42)

// @ts-expect-error enrichedBlocksToMarkdown requires the exportComponents flag
enrichedBlocksToMarkdown(body)
`

describePackedPackage({
    packageName: "@ourworldindata/gdoc-pipeline",
    tarballPath: path.join(pkgDir, "dist-package/gdoc-pipeline.tgz"),
    declarationFile: "dist/gdoc-pipeline.d.ts",
    manifest: {
        main: "dist/gdoc-pipeline.js",
        types: "dist/gdoc-pipeline.d.ts",
        // The two type-only externals its declaration bundle still imports
        // from (see allowedTypeImports), declared as optional peer
        // dependencies so consumers who need them are told which versions to
        // install.
        peerDependencies: ["@googleapis/docs", "zod"],
    },
    maxEntries: 15,
    typeDependencies: ["@googleapis/docs", "googleapis-common", "zod"],
    // Both declared as optional peer dependencies:
    //
    //   @googleapis/docs  the Google Docs document JSON types that gdocToArchie
    //                     consumes
    //   zod               the schema types behind the zod-backed aliases that
    //                     @ourworldindata/types contributes to the API surface;
    //                     zod itself is bundled into the JS, so this is a
    //                     type-only dependency
    allowedTypeImports: /^(@googleapis\/docs|zod)(\/|$)/,
    consumerSource: CONSUMER_SOURCE,
})
