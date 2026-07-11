import * as React from "react"
import {
    ComponentRegistry,
    DbPlainTag,
    JsonError,
    OwidEnrichedGdocBlock,
    OwidGdocPostContent,
    OwidGdocType,
    SiteFooterContext,
} from "@ourworldindata/types"
import {
    extractGdocPageData,
    traverseEnrichedBlock,
} from "@ourworldindata/utils"
import { Html } from "../site/Html.js"
import { Head } from "../site/Head.js"
import { OwidGdoc } from "../site/gdocs/OwidGdoc.js"
import { DebugProvider } from "../site/gdocs/DebugProvider.js"
import { AriaAnnouncerProvider } from "../site/AriaAnnouncerContext.js"
import { AriaAnnouncer } from "../site/AriaAnnouncer.js"
import { viteAssetsForSite } from "../site/viteUtils.js"
import { renderToHtmlPage } from "../serverUtils/serverUtil.js"
import { BAKED_BASE_URL } from "../settings/serverSettings.js"
import * as db from "../db/db.js"
import { archieToEnriched } from "../db/model/Gdoc/archieToEnriched.js"
import {
    gdocFromJSON,
    getLatestDataInsights,
} from "../db/model/Gdoc/GdocFactory.js"
import {
    applyDraftOverrides,
    parseDraftOverrides,
    tryParseRaw,
} from "./gdocsReferenceMinimal.js"
import { getPublicDonorNames } from "../db/model/Donor.js"

// The committed generated registry — same source the
// /api/gdocs-reference/components.json endpoint serves.
import componentsRegistry from "../docs/components.registry.generated.json"

/**
 * Live previews for the admin writing reference page (GdocsReferencePage):
 * each registry example's ArchieML is parsed with the real ingestion pipeline
 * (archieToEnriched), loaded with its database context (linked charts,
 * images, documents, …), and server-rendered with the same components and
 * hydration path the site uses for articles. What authors see in the
 * reference gallery is exactly what the component looks like in production.
 *
 * The page is meant to be embedded in an iframe; it reports its rendered
 * height to the parent via postMessage so the iframe can be sized to fit.
 */

// Chrome hidden in every preview: the in-page admin links bar and the cookie
// notice (the iframe shares the admin origin; consent is not its job).
// !important throughout: in dev, Vite injects the site stylesheets at runtime
// after this inline tag, so equal-specificity rules would override it.
const SHARED_PREVIEW_STYLES = `
body { background: #fff; }
.gdoc-admin-bar { display: none !important; }
.cookie-manager { display: none !important; }
`

// Component examples are body fragments; render them as a minimal article and
// hide the article page chrome (header, citation, license) around the blocks.
const COMPONENT_PREVIEW_STYLES = `
${SHARED_PREVIEW_STYLES}
.centered-article-header__banner,
.centered-article-header,
.topic-page-header { display: none !important; }
#article-citation, #article-licence { display: none !important; }
.centered-article-container { margin-top: 24px !important; padding-bottom: 24px !important; }
`

// Reports the document height to the embedding admin page whenever it
// changes, tagged with the preview id ("pid" query param) so the parent can
// match the message to the right iframe.
const HEIGHT_REPORTER_SCRIPT = `
(() => {
    const pid = new URLSearchParams(location.search).get("pid") || "";
    let lastHeight = 0;
    const report = () => {
        const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
        if (height === lastHeight) return;
        lastHeight = height;
        parent.postMessage({ type: "owid-gdocs-ref-preview-height", pid, height }, location.origin);
    };
    new ResizeObserver(report).observe(document.documentElement);
    window.addEventListener("load", report);
})();
`

// The concrete gdoc class union — carries every attachment field, unlike the
// per-page-type OwidGdoc interfaces.
type SyntheticGdoc = ReturnType<typeof gdocFromJSON>

function GdocsReferencePreviewPage({
    gdoc,
    pageTitle,
    styles,
}: {
    gdoc: SyntheticGdoc
    pageTitle: string
    styles: string
}): React.ReactElement {
    // Mirrors OwidGdocPage: the SSR tree inside #owid-document-root and the
    // serialized window._OWID_GDOC_PROPS must line up with what
    // runSiteFooterScripts' hydrateOwidGdoc renders on the client.
    // extractGdocPageData only keeps donors / latestDataInsights for the page
    // types that normally show them; the preview loads them for any doc whose
    // blocks need them, so serialize them unconditionally.
    const pageData = {
        ...extractGdocPageData(gdoc),
        donors: gdoc.donors,
        latestDataInsights: gdoc.latestDataInsights,
    }
    return (
        <Html>
            <Head
                canonicalUrl={`${BAKED_BASE_URL}/admin/gdocs-reference-preview`}
                pageTitle={pageTitle}
                baseUrl={BAKED_BASE_URL}
            >
                <meta name="robots" content="noindex" />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window._OWID_GDOC_PROPS = ${JSON.stringify(
                            pageData
                        )}`,
                    }}
                ></script>
                <style dangerouslySetInnerHTML={{ __html: styles }}></style>
            </Head>
            <body>
                <div id="owid-document-root">
                    <AriaAnnouncerProvider>
                        <DebugProvider debug>
                            <OwidGdoc {...gdoc} isPreviewing />
                        </DebugProvider>
                        <AriaAnnouncer />
                    </AriaAnnouncerProvider>
                </div>
                {viteAssetsForSite({}).forFooter}
                <script
                    type="module"
                    dangerouslySetInnerHTML={{
                        __html: `window.runSiteFooterScripts(${JSON.stringify({
                            context: SiteFooterContext.gdocsDocument,
                            debug: true,
                            isPreviewing: true,
                        })});`,
                    }}
                />
                <script
                    dangerouslySetInnerHTML={{
                        __html: HEIGHT_REPORTER_SCRIPT,
                    }}
                />
            </body>
        </Html>
    )
}

function getExampleArchie(
    doc: { id: string; examples: { archie: string }[] },
    exampleParam: string | undefined
): string {
    const index = exampleParam ? parseInt(exampleParam, 10) : 0
    const example = Number.isInteger(index) ? doc.examples[index] : undefined
    if (!example)
        throw new JsonError(
            `"${doc.id}" has no example at index "${exampleParam}"`,
            404
        )
    return example.archie
}

function collectBlockTypes(content: OwidGdocPostContent): Set<string> {
    const types = new Set<string>()
    for (const block of content.body ?? [])
        traverseEnrichedBlock(block, (child) => types.add(child.type))
    return types
}

// Blocks that derive their content from the document's topic tags — they
// render an error placeholder on an untagged document.
const TAG_DEPENDENT_BLOCK_TYPES = ["all-charts", "featured-metrics", "ltp-toc"]

// A real topic tag for the synthetic doc, so tag-dependent blocks preview
// with real content. Any topic works; this one has plenty of charts.
const PREVIEW_TAG_SLUG = "life-expectancy"

// A synthetic, never-persisted gdoc that exists only for this render, loaded
// with the database context (linked charts, images, documents, …) its blocks
// reference. Attachments that only a specific page type loads (topic tags,
// donors, latest data insights) are loaded here whenever a block needs them,
// so every component previews with real content.
async function loadSyntheticGdoc(
    content: OwidGdocPostContent,
    publishedAt: Date | null,
    knex: db.KnexReadonlyTransaction,
    // When the preview extracts a block from a real document, tag-dependent
    // blocks should use that document's real topic tags, not the fallback.
    tagsFromGdocId?: string
): Promise<SyntheticGdoc> {
    const gdoc = gdocFromJSON({
        id: "gdocs-reference-preview",
        slug: "gdocs-reference-preview",
        content,
        published: false,
        publishedAt,
        createdAt: new Date(),
        updatedAt: new Date(),
    })
    const blockTypes = collectBlockTypes(content)

    // Production applies this while parsing the gdoc (see GdocBase); it
    // derives content the components read — toc, sticky-nav, citation.
    gdoc._enrichSubclassContent(gdoc.content)

    // Before loadState: loadRelatedCharts (for all-charts) reads the tags.
    if (TAG_DEPENDENT_BLOCK_TYPES.some((type) => blockTypes.has(type))) {
        if (tagsFromGdocId) {
            gdoc.tags = await db.knexRaw<DbPlainTag>(
                knex,
                `-- sql
                SELECT t.* FROM tags t
                JOIN posts_gdocs_x_tags pgt ON pgt.tagId = t.id
                WHERE pgt.gdocId = ?`,
                [tagsFromGdocId]
            )
        }
        if (!gdoc.tags || gdoc.tags.length === 0) {
            gdoc.tags = await db.knexRaw<DbPlainTag>(
                knex,
                `SELECT * FROM tags WHERE slug = ? LIMIT 1`,
                [PREVIEW_TAG_SLUG]
            )
        }
    }

    await gdoc.loadState(knex)

    if (blockTypes.has("donors")) gdoc.donors = await getPublicDonorNames(knex)
    if (blockTypes.has("latest-data-insights")) {
        const { dataInsights, imageMetadata } =
            await getLatestDataInsights(knex)
        gdoc.latestDataInsights = dataInsights
        gdoc.imageMetadata = Object.assign(gdoc.imageMetadata, imageMetadata)
    }
    return gdoc
}

export async function renderGdocsReferenceComponentPreview(
    componentId: string,
    exampleParam: string | undefined,
    knex: db.KnexReadonlyTransaction
): Promise<string> {
    const doc = (componentsRegistry as ComponentRegistry).components.find(
        (component) => component.id === componentId
    )
    if (!doc) throw new JsonError(`No such component: "${componentId}"`, 404)
    const archie = getExampleArchie(doc, exampleParam)

    // Same wrapping the registry generator validates the example with, but
    // typed as an article so the site renders the blocks (fragments render as
    // raw JSON). The chrome an article adds around the body is hidden by the
    // preview stylesheet.
    const wrapped = `title: ${doc.title} example\ntype: ${OwidGdocType.Article}\n[+body]\n${archie}\n[]\n`
    const content = archieToEnriched(wrapped)
    content["hide-citation"] = true
    content["hide-subscribe-banner"] = true

    // The linear-topic-page TOC derives its sections from h1s, which only
    // happens when the document actually is a linear topic page.
    if (collectBlockTypes(content).has("ltp-toc"))
        content.type = OwidGdocType.LinearTopicPage

    const gdoc = await loadSyntheticGdoc(content, null, knex)
    return renderToHtmlPage(
        <GdocsReferencePreviewPage
            gdoc={gdoc}
            pageTitle={`${doc.title} — component preview`}
            styles={COMPONENT_PREVIEW_STYLES}
        />
    )
}

// Resolve a posts_gdocs_components path like "$.body[3].items[0]" within a
// document's enriched content. Returns undefined unless the target is a
// renderable block (an object with a string "type").
export function resolveBlockAtPath(
    content: unknown,
    path: string
): (OwidEnrichedGdocBlock & Record<string, unknown>) | undefined {
    if (!/^\$[.[]/.test(path)) return undefined
    let node: unknown = content
    for (const match of path.slice(1).matchAll(/\[(\d+)\]|\.([^.[\]]+)/g)) {
        if (node === null || typeof node !== "object") return undefined
        const key = match[1] !== undefined ? parseInt(match[1], 10) : match[2]
        node = (node as Record<string | number, unknown>)[key]
    }
    if (
        node !== null &&
        typeof node === "object" &&
        typeof (node as { type?: unknown }).type === "string"
    )
        return node as OwidEnrichedGdocBlock & Record<string, unknown>
    return undefined
}

/**
 * Preview of a real component instance: the block at `path` in a published
 * document, rendered with that document's real context — its linked charts,
 * images and topic tags — so what the reference shows is exactly what the
 * live site renders. With `overrides` (the form builder's cycled props,
 * JSON-encoded), the block is reshaped and re-parsed before rendering — the
 * live half of the draft card.
 */
export async function renderGdocsReferenceInstancePreview(
    gdocId: string | undefined,
    pathParam: string | undefined,
    knex: db.KnexReadonlyTransaction,
    overridesParam?: string
): Promise<string> {
    if (!gdocId || !pathParam)
        throw new JsonError("gdocId and path are required", 400)
    const [row] = await db.knexRaw<{
        slug: string
        publishedAt: Date | null
        content: string
    }>(
        knex,
        `-- sql
        SELECT slug, publishedAt, content
        FROM posts_gdocs
        WHERE id = ? AND published = 1
        LIMIT 1`,
        [gdocId]
    )
    if (!row) throw new JsonError(`No published gdoc with id "${gdocId}"`, 404)

    const sourceContent =
        typeof row.content === "string" ? JSON.parse(row.content) : row.content
    let block = resolveBlockAtPath(sourceContent, pathParam)
    if (!block)
        throw new JsonError(
            `No renderable block at "${pathParam}" in gdoc "${gdocId}"`,
            404
        )

    const overrides = parseDraftOverrides(overridesParam)
    if (overrides) {
        const draft = applyDraftOverrides(block, overrides)
        // Render the draft's re-parse even when it has parse errors — the
        // debug preview shows those visibly, which is exactly the feedback a
        // combination the parser rejects should give the author.
        const reparsed = draft && tryParseRaw(draft.raw)
        if (!reparsed)
            throw new JsonError("This block has no properties to shape", 400)
        block = reparsed as OwidEnrichedGdocBlock & Record<string, unknown>
    }

    // An empty article shell for its enrichment defaults (same as the
    // registry example previews), carrying just the extracted block.
    const content = archieToEnriched(
        `title: ${row.slug} — instance preview\ntype: ${OwidGdocType.Article}\n[+body]\n[]\n`
    )
    content.body = [block]
    content["hide-citation"] = true
    content["hide-subscribe-banner"] = true
    if (collectBlockTypes(content).has("ltp-toc"))
        content.type = OwidGdocType.LinearTopicPage

    const gdoc = await loadSyntheticGdoc(content, row.publishedAt, knex, gdocId)
    return renderToHtmlPage(
        <GdocsReferencePreviewPage
            gdoc={gdoc}
            pageTitle={`${block.type} from ${row.slug} — instance preview`}
            styles={COMPONENT_PREVIEW_STYLES}
        />
    )
}
