# Gdoc pipeline

The pure conversion layer of [Our World in Data](https://ourworldindata.org/)'s Google-Docs-based CMS. Content on ourworldindata.org is authored in Google Docs using [ArchieML](http://archieml.org/); this package converts between the formats involved:

- **Google Docs → ArchieML**: `gdocToArchie` walks a document's JSON (as returned by the Google Docs API) and produces ArchieML text, serializing rich text as HTML spans.
- **ArchieML → enriched blocks**: `archieToEnriched` parses ArchieML text into OWID's typed content blocks (`OwidEnrichedGdocBlock`), including ref extraction, per-component parsing and validation (`rawToEnriched`), and HTML span parsing (`htmlToEnriched`). Parsing never throws — every block carries a `parseErrors` array.
- **Enriched blocks → ArchieML**: `enrichedToRaw` + `rawToArchie` serialize blocks back to ArchieML text.
- **Enriched blocks → Markdown / indexable text**: `enrichedToMarkdown` and `enrichedToIndexableText` render blocks as plain text for search indexing and fallbacks.

The package also re-exports the type surface these conversions are expressed in (the raw and enriched block unions, `Span`, the gdoc content types, …) and the handful of helpers from OWID's internal workspace packages that belong to the pipeline's API (e.g. `traverseEnrichedBlock`, `convertHeadingTextToId`), since those packages aren't published individually.

What this package deliberately does **not** contain: fetching documents from the Google Docs API, the `GdocBase` class hierarchy, and everything that touches OWID's database — all of that lives in the [owid-grapher](https://github.com/owid/owid-grapher) monorepo (`db/model/Gdoc/`), which consumes this package for the pure conversions.

## Using the package

### Installation

The package is published as `@ourworldindata/gdoc-pipeline` to OWID's private npm registry at `https://packages.owid.io`, so installing it requires an auth token for that registry. Point your package manager at it — for npm, in the consuming project's `.npmrc`:

```
@ourworldindata:registry=https://packages.owid.io
//packages.owid.io/:_authToken=<your auth token>
```

(For Yarn Berry, set the equivalent `npmScopes.ourworldindata.npmRegistryServer` and `npmAuthToken` in `.yarnrc.yml`.) Then install as usual:

```bash
npm install @ourworldindata/gdoc-pipeline
```

The package is ESM-only and has **no runtime dependencies** — everything (archieml, cheerio, lodash-es, and OWID's internal workspace packages) is bundled. It runs in browsers as well as Node; nothing in it touches node builtins.

`@googleapis/docs` is an **optional peer dependency**, used purely for its types: `gdocToArchie` consumes the Google Docs API's document JSON (`docs_v1.Schema$Document`). Install it if you call `gdocToArchie` from TypeScript; if you only work with ArchieML text and enriched blocks, you don't need it.

### Quick start

```ts
import {
    archieToEnriched,
    enrichedBlocksToMarkdown,
    enrichedBlockToRawBlock,
    OwidRawGdocBlockToArchieMLString,
} from "@ourworldindata/gdoc-pipeline"

// ArchieML text -> enriched blocks
const content = archieToEnriched(archieMlText)
for (const block of content.body ?? []) {
    console.log(block.type, block.parseErrors)
}

// enriched blocks -> Markdown (e.g. for search indexing)
const markdown = enrichedBlocksToMarkdown(content.body, false)

// enriched blocks -> ArchieML text
const archie = (content.body ?? [])
    .map((block) => OwidRawGdocBlockToArchieMLString(enrichedBlockToRawBlock(block)))
    .join("")
```

To start from a Google Doc, fetch the document JSON yourself (Google Docs API `documents.get`, ideally with `suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS"`) and run it through `gdocToArchie` first:

```ts
import { gdocToArchie, archieToEnriched } from "@ourworldindata/gdoc-pipeline"

const { text } = await gdocToArchie(documentJson)
const content = archieToEnriched(text)
```

## Developing the package

Inside the owid-grapher monorepo the package is consumed directly from source (`main: src/index.ts`) like the other `@ourworldindata/*` workspace packages — no build step is involved in normal development, and the unit tests run as part of the repo-wide `yarn test`.

The published artifacts are built with [tsdown](https://tsdown.dev/) (see `tsdown.config.ts`):

- `dist/gdoc-pipeline.js` — the bundled ES module (all dependencies inlined)
- `dist/gdoc-pipeline.d.ts` — its type declarations, with the types of the internal `@ourworldindata/*` workspace packages inlined; only `@googleapis/docs` stays an external type import

Build and verify from this directory:

```bash
yarn build
yarn testPackage
```

`yarn testPackage` packs the package to `dist-package/gdoc-pipeline.tgz` (a `yarn pack`, which applies `publishConfig`) and then runs the smoke tests in `packageTest/`: they import the built bundle and run the pipeline end-to-end, assert the bundle is fully self-contained, typecheck a simulated external consumer against the tarball's bundled type declarations — with `moduleResolution: bundler` and `nodenext`, plus a full check of the declaration bundle itself — and run [publint](https://publint.dev) and [`@arethetypeswrong/cli`](https://github.com/arethetypeswrong/arethetypeswrong.github.io) passes over the tarball. These tests are intentionally not part of the repo-wide `yarn test` since they depend on `dist/` and the packed tarball.

### Publishing a release

Releases go to OWID's private registry at `https://packages.owid.io` (set as `publishConfig.registry`). From this directory, with the build verified (`yarn build` + `yarn testPackage`):

```bash
yarn bumpp
```

Once that commit & tag (`gdoc-pipeline@<version>`) are pushed to `master`, a Buildkite pipeline runs the publish to the private npm registry.
