import {
    ComponentDoc,
    ComponentInstance,
    ComponentInstancesResponse,
    ComponentUsage,
    ComponentUsageByDocType,
    ComponentUsageLabel,
    ComponentVariation,
    ExemplarOutline,
    ExemplarSection,
    GdocsReferenceUsage,
    JsonError,
    OwidEnrichedGdocBlock,
    OwidGdocType,
    PinnedExampleRef,
    TemplateDoc,
    TemplateExemplarsResponse,
} from "@ourworldindata/types"
import { spansToUnformattedPlainText } from "@ourworldindata/utils"
import { convertHeadingTextToId } from "@ourworldindata/components"
import * as db from "../../db/db.js"
import { enrichedBlockToRawBlock } from "../../db/model/Gdoc/enrichedToRaw.js"
import { OwidRawGdocBlockToArchieMLString } from "../../db/model/Gdoc/rawToArchie.js"
import { Request } from "../authentication.js"
import { HandlerResponse } from "../FunctionalRouter.js"

import componentsRegistry from "../../docs/components.registry.generated.json"
import templatesRegistry from "../../docs/templates.registry.generated.json"

/**
 * The live half of the admin writing reference: everything here is computed
 * at request time from posts_gdocs / posts_gdocs_components, so it reflects
 * current published content and cannot go stale. The generated registries
 * carry the curated half (prose, pinned example refs, exemplar slugs); this
 * module resolves those refs against reality and reports the ones that no
 * longer hold, so editors see staleness instead of broken pages.
 */

// -----------------------------------------------------------------------------
// Usage aggregate
// -----------------------------------------------------------------------------

// Fraction of published docs (of one type) using a component → the
// qualitative label the UI leads with. Raw fractions ship alongside for
// tooltips — never as the primary presentation.
function usageLabel(fraction: number): ComponentUsageLabel {
    if (fraction >= 0.4) return "standard"
    if (fraction >= 0.1) return "common"
    if (fraction >= 0.02) return "occasional"
    if (fraction > 0) return "rare"
    return "unused"
}

export async function getGdocsReferenceUsage(
    _req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
): Promise<GdocsReferenceUsage> {
    const totals = await db.knexRaw<{ docType: string; total: number }>(
        trx,
        `-- sql
        SELECT type AS docType, COUNT(*) AS total
        FROM posts_gdocs
        WHERE published = 1
        GROUP BY type`
    )
    const totalDocsByType: Partial<Record<OwidGdocType, number>> = {}
    for (const row of totals)
        totalDocsByType[row.docType as OwidGdocType] = Number(row.total)

    const rows = await db.knexRaw<{
        docType: string
        componentId: string
        docsUsingIt: number
        totalUses: number
    }>(
        trx,
        `-- sql
        SELECT
            pg.type AS docType,
            c.config->>'$.type' AS componentId,
            COUNT(DISTINCT c.gdocId) AS docsUsingIt,
            COUNT(*) AS totalUses
        FROM posts_gdocs_components c
        JOIN posts_gdocs pg ON pg.id = c.gdocId
        WHERE pg.published = 1
        GROUP BY docType, componentId`
    )

    const byComponent = new Map<string, ComponentUsage>()
    for (const row of rows) {
        if (!row.componentId) continue
        let usage = byComponent.get(row.componentId)
        if (!usage) {
            usage = {
                componentId: row.componentId,
                docsUsingIt: 0,
                totalUses: 0,
                byDocType: [],
            }
            byComponent.set(row.componentId, usage)
        }
        const docType = row.docType as OwidGdocType
        const totalDocs = totalDocsByType[docType] ?? 0
        const docsUsingIt = Number(row.docsUsingIt)
        const entry: ComponentUsageByDocType = {
            docType,
            docsUsingIt,
            totalDocs,
            label: usageLabel(totalDocs > 0 ? docsUsingIt / totalDocs : 0),
        }
        usage.byDocType.push(entry)
        usage.docsUsingIt += docsUsingIt
        usage.totalUses += Number(row.totalUses)
    }

    const components = [...byComponent.values()].sort(
        (a, b) => b.docsUsingIt - a.docsUsingIt
    )
    for (const usage of components)
        usage.byDocType.sort(
            (a, b) =>
                b.docsUsingIt / Math.max(1, b.totalDocs) -
                a.docsUsingIt / Math.max(1, a.totalDocs)
        )

    return { components, totalDocsByType }
}

// -----------------------------------------------------------------------------
// Real instances + observed variations
// -----------------------------------------------------------------------------

const PAGE_SIZE = 12
const MAX_VARIATIONS = 20

// Instances scanned per request for signature/variation computation. Only
// prose blocks (text: ~29k uses) exceed this — and their variations are
// degenerate anyway. The scan takes the most recently published instances,
// so a sampled ranking reflects current practice.
const SCAN_MAX = 5000

interface InstanceRow {
    gdocId: string
    path: string
    config: string | Record<string, unknown>
    slug: string
    docType: string
    publishedAt: Date | string | null
    title: string | null
}

// An InstanceRow parsed and signed, before it is trimmed down to the
// ComponentInstance wire shape.
interface ScannedInstance {
    row: InstanceRow
    block: OwidEnrichedGdocBlock | undefined
    signature: string
}

// Raw-block value keys whose (scalar) value distinguishes variations worth
// browsing separately — e.g. a narrow chart is a different form than a wide
// one, but two charts with different URLs are the same form.
const SALIENT_VALUE_KEYS = new Set([
    "size",
    "position",
    "align",
    "alignment",
    "icon",
    "style",
    "variant",
    "level",
])

function parseConfig(
    config: InstanceRow["config"]
): OwidEnrichedGdocBlock | undefined {
    try {
        const parsed = typeof config === "string" ? JSON.parse(config) : config
        if (parsed && typeof parsed === "object" && "type" in parsed)
            return parsed as OwidEnrichedGdocBlock
    } catch {
        // fall through — a malformed stored config yields no block
    }
    return undefined
}

/**
 * The observed configuration shape of a block, derived from what an author
 * actually writes: the enriched config is converted back to its raw form
 * (dropping enrichment defaults), and the signature is the sorted set of
 * authored value keys, with salient scalar values inlined ("caption+size:narrow").
 * The bare form (a plain string value, e.g. a chart that is just a URL) is "".
 */
function variationSignature(block: OwidEnrichedGdocBlock | undefined): string {
    if (!block) return ""
    let raw
    try {
        raw = enrichedBlockToRawBlock(block)
    } catch {
        return ""
    }
    const value = (raw as { value?: unknown }).value
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return ""
    const parts: string[] = []
    for (const [key, v] of Object.entries(value)) {
        if (v === undefined || v === null) continue
        if (typeof v === "string" && v.trim() === "") continue
        if (Array.isArray(v) && v.length === 0) continue
        if (
            SALIENT_VALUE_KEYS.has(key) &&
            (typeof v === "string" || typeof v === "number")
        )
            parts.push(key + ":" + String(v))
        else parts.push(key)
    }
    return parts.sort().join("+")
}

function blockToArchie(
    block: OwidEnrichedGdocBlock | undefined
): string | undefined {
    if (!block) return undefined
    try {
        return OwidRawGdocBlockToArchieMLString(enrichedBlockToRawBlock(block))
    } catch {
        return undefined
    }
}

// Numeric-aware document-order comparison of JSON paths: "$.body[2]" sorts
// before "$.body[10]", which plain string comparison gets wrong.
function tokenizePath(path: string): (string | number)[] {
    const tokens: (string | number)[] = []
    for (const m of path.matchAll(/\[(\d+)\]|([^.[\]]+)/g)) {
        if (m[1] !== undefined) tokens.push(parseInt(m[1], 10))
        else tokens.push(m[2])
    }
    return tokens
}

function comparePathsDocumentOrder(a: string, b: string): number {
    const ta = tokenizePath(a)
    const tb = tokenizePath(b)
    for (let i = 0; i < Math.min(ta.length, tb.length); i++) {
        if (ta[i] === tb[i]) continue
        if (typeof ta[i] === "number" && typeof tb[i] === "number")
            return (ta[i] as number) - (tb[i] as number)
        return String(ta[i]) < String(tb[i]) ? -1 : 1
    }
    return ta.length - tb.length
}

function toIsoOrNull(value: Date | string | null): string | null {
    if (value === null) return null
    return value instanceof Date ? value.toISOString() : String(value)
}

function toInstance(scanned: ScannedInstance): ComponentInstance {
    const { row, signature } = scanned
    return {
        gdocId: row.gdocId,
        slug: row.slug,
        title: row.title ?? row.slug,
        docType: row.docType as OwidGdocType,
        path: row.path,
        publishedAt: toIsoOrNull(row.publishedAt),
        variation: signature,
    }
}

// The anchor an instance's section has on the live page: the id of the
// nearest heading at or above the instance's top-level position — the same id
// the site renders via convertHeadingTextToId.
function nearestHeadingAnchor(
    body: OwidEnrichedGdocBlock[],
    path: string
): string | undefined {
    const m = /^\$\.body\[(\d+)\]/.exec(path)
    if (!m) return undefined
    const index = Math.min(parseInt(m[1], 10), body.length - 1)
    for (let i = index; i >= 0; i--) {
        const block = body[i]
        if (block?.type === "heading")
            return convertHeadingTextToId(block.text)
    }
    return undefined
}

// Load the enriched bodies of the given docs — only ever called for the
// handful of docs whose instances a response actually shows.
async function loadBodies(
    trx: db.KnexReadonlyTransaction,
    gdocIds: string[]
): Promise<Map<string, OwidEnrichedGdocBlock[]>> {
    const bodies = new Map<string, OwidEnrichedGdocBlock[]>()
    if (gdocIds.length === 0) return bodies
    const rows = await db.knexRaw<{ id: string; content: string }>(
        trx,
        `-- sql
        SELECT id, content FROM posts_gdocs WHERE id IN (?)`,
        [gdocIds]
    )
    for (const row of rows) {
        try {
            const content =
                typeof row.content === "string"
                    ? JSON.parse(row.content)
                    : row.content
            if (Array.isArray(content?.body)) bodies.set(row.id, content.body)
        } catch {
            // no anchor for docs whose content fails to parse
        }
    }
    return bodies
}

export async function getComponentInstances(
    req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
): Promise<ComponentInstancesResponse> {
    const componentId = req.params.id
    const doc = (componentsRegistry as ComponentDoc[]).find(
        (component) => component.id === componentId
    )
    if (!doc) throw new JsonError(`No such component: "${componentId}"`, 404)

    const docTypeFilter = req.query.docType as string | undefined
    const variationFilter = req.query.variation as string | undefined
    const page = Math.max(0, parseInt((req.query.page as string) ?? "0", 10))

    const rows = await db.knexRaw<InstanceRow>(
        trx,
        `-- sql
        SELECT
            c.gdocId,
            c.path,
            c.config,
            pg.slug,
            pg.type AS docType,
            pg.publishedAt,
            pg.content->>'$.title' AS title
        FROM posts_gdocs_components c
        JOIN posts_gdocs pg ON pg.id = c.gdocId
        WHERE pg.published = 1
            AND c.config->>'$.type' = ?
        ORDER BY pg.publishedAt DESC, c.gdocId, c.path
        LIMIT ${SCAN_MAX}`,
        [componentId]
    )

    const scanned: ScannedInstance[] = rows.map((row) => {
        const block = parseConfig(row.config)
        return { row, block, signature: variationSignature(block) }
    })

    // Variations rank over the full (unfiltered) scan.
    const bySignature = new Map<string, ScannedInstance[]>()
    for (const instance of scanned) {
        const group = bySignature.get(instance.signature)
        if (group) group.push(instance)
        else bySignature.set(instance.signature, [instance])
    }
    const variationGroups = [...bySignature.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, MAX_VARIATIONS)

    // Pinned refs resolve against document order within their doc; a ref that
    // no longer resolves is reported as stale, never silently dropped.
    const pinned: ScannedInstance[] = []
    const stalePins: PinnedExampleRef[] = []
    for (const ref of doc.pinned ?? []) {
        const inDoc = scanned
            .filter((instance) => instance.row.slug === ref.slug)
            .sort((a, b) => comparePathsDocumentOrder(a.row.path, b.row.path))
        const match = inDoc[(ref.nth ?? 1) - 1]
        if (match) pinned.push(match)
        else stalePins.push(ref)
    }

    const filtered = scanned.filter(
        (instance) =>
            (docTypeFilter === undefined ||
                instance.row.docType === docTypeFilter) &&
            (variationFilter === undefined ||
                instance.signature === variationFilter)
    )
    const pageInstances = filtered.slice(
        page * PAGE_SIZE,
        (page + 1) * PAGE_SIZE
    )

    // The true total can exceed the scan when a component has more than
    // SCAN_MAX uses; count it exactly unless a variation filter (which only
    // exists within the scan) is active.
    let total = filtered.length
    if (variationFilter === undefined && rows.length === SCAN_MAX) {
        const [countRow] = await db.knexRaw<{ total: number }>(
            trx,
            `-- sql
            SELECT COUNT(*) AS total
            FROM posts_gdocs_components c
            JOIN posts_gdocs pg ON pg.id = c.gdocId
            WHERE pg.published = 1
                AND c.config->>'$.type' = ?
                ${docTypeFilter === undefined ? "" : "AND pg.type = ?"}`,
            docTypeFilter === undefined
                ? [componentId]
                : [componentId, docTypeFilter]
        )
        total = Number(countRow?.total ?? filtered.length)
    }

    // Anchors + archie only for what this response actually shows.
    const shown = [
        ...pageInstances,
        ...pinned,
        ...variationGroups.map(([, group]) => group[0]),
    ]
    const bodies = await loadBodies(trx, [
        ...new Set(shown.map((instance) => instance.row.gdocId)),
    ])
    const present = (scannedInstance: ScannedInstance): ComponentInstance => {
        const instance = toInstance(scannedInstance)
        const body = bodies.get(scannedInstance.row.gdocId)
        if (body) instance.anchor = nearestHeadingAnchor(body, instance.path)
        instance.archie = blockToArchie(scannedInstance.block)
        return instance
    }

    const variations: ComponentVariation[] = variationGroups.map(
        ([signature, group]) => ({
            signature,
            count: group.length,
            representative: present(group[0]),
        })
    )

    return {
        componentId,
        total,
        instances: pageInstances.map(present),
        variations,
        pinned: pinned.map(present),
        stalePins,
    }
}

// -----------------------------------------------------------------------------
// Template exemplar outlines
// -----------------------------------------------------------------------------

// Blocks that form a major page section of their own on topic pages — they
// break the outline like a heading does.
const SECTION_BLOCK_TYPES = new Set([
    "topic-page-intro",
    "key-insights",
    "all-charts",
    "research-and-writing",
    "explore-data-section",
    "ltp-toc",
    "sdg-grid",
])

interface WorkingSection {
    heading?: string
    anchor?: string
    composition: Record<string, number>
    blocks: { componentId: string; path: string }[]
    repeats: number
}

function newSection(heading?: string, anchor?: string): WorkingSection {
    return { heading, anchor, composition: {}, blocks: [], repeats: 1 }
}

function typeSet(section: WorkingSection): string {
    return Object.keys(section.composition).sort().join("+")
}

/**
 * The x-ray altitude: split a document's body into sections at h1/h2 headings
 * (and marquee blocks that form sections of their own), then collapse runs of
 * same-shaped sections — "5 more sections like this", never a flat block dump.
 */
function computeSections(body: OwidEnrichedGdocBlock[]): ExemplarSection[] {
    const sections: WorkingSection[] = []
    let current: WorkingSection | undefined

    const push = (section: WorkingSection | undefined): void => {
        if (!section || section.blocks.length === 0) return
        const previous = sections[sections.length - 1]
        // Roll up a run of sections with the same component mix. Only
        // heading-opened sections collapse — marquee sections stay distinct.
        if (
            previous &&
            previous.heading !== undefined &&
            section.heading !== undefined &&
            typeSet(previous) === typeSet(section)
        ) {
            previous.repeats += 1
            return
        }
        sections.push(section)
    }

    for (const [index, block] of body.entries()) {
        if (!block?.type) continue
        const path = `$.body[${index}]`
        const isSectionHeading =
            block.type === "heading" && (block.level === 1 || block.level === 2)
        if (isSectionHeading) {
            push(current)
            current = newSection(
                spansToUnformattedPlainText(block.text),
                convertHeadingTextToId(block.text)
            )
            continue
        }
        if (SECTION_BLOCK_TYPES.has(block.type)) {
            push(current)
            const marquee = newSection()
            marquee.composition[block.type] = 1
            marquee.blocks.push({ componentId: block.type, path })
            push(marquee)
            current = undefined
            continue
        }
        if (!current) current = newSection()
        current.composition[block.type] =
            (current.composition[block.type] ?? 0) + 1
        current.blocks.push({ componentId: block.type, path })
    }
    push(current)

    return sections.map((section) => ({
        ...(section.heading !== undefined && { heading: section.heading }),
        ...(section.anchor !== undefined && { anchor: section.anchor }),
        composition: section.composition,
        blocks: section.blocks,
        ...(section.repeats > 1 && { repeats: section.repeats }),
    }))
}

export async function getTemplateExemplars(
    req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
): Promise<TemplateExemplarsResponse> {
    const templateId = req.params.id
    const template = (templatesRegistry as TemplateDoc[]).find(
        (doc) => doc.id === templateId
    )
    if (!template)
        throw new JsonError(`No such template: "${templateId}"`, 404)

    const exemplars: ExemplarOutline[] = []
    const staleExemplars: string[] = []
    for (const slug of template.exemplars ?? []) {
        const [row] = await db.knexRaw<{
            slug: string
            docType: string
            publishedAt: Date | string | null
            title: string | null
            content: string
        }>(
            trx,
            `-- sql
            SELECT
                slug,
                type AS docType,
                publishedAt,
                content->>'$.title' AS title,
                content
            FROM posts_gdocs
            WHERE slug = ? AND published = 1 AND type = ?
            LIMIT 1`,
            [slug, templateId]
        )
        if (!row) {
            staleExemplars.push(slug)
            continue
        }
        let body: OwidEnrichedGdocBlock[] = []
        try {
            const content =
                typeof row.content === "string"
                    ? JSON.parse(row.content)
                    : row.content
            if (Array.isArray(content?.body)) body = content.body
        } catch {
            staleExemplars.push(slug)
            continue
        }
        exemplars.push({
            slug: row.slug,
            title: row.title ?? row.slug,
            docType: row.docType as OwidGdocType,
            publishedAt: toIsoOrNull(row.publishedAt),
            sections: computeSections(body),
        })
    }

    return { templateId, exemplars, staleExemplars }
}
