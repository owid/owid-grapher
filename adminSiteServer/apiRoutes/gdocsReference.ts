import {
    ComponentDraftResponse,
    ComponentInstance,
    ComponentInstancesResponse,
    ComponentRegistry,
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
    OwidRawGdocBlock,
    PinnedExampleRef,
    SyntheticExampleInfo,
    TemplateDoc,
    TemplateExemplarsResponse,
} from "@ourworldindata/types"
import { spansToUnformattedPlainText } from "@ourworldindata/utils"
import { convertHeadingTextToId } from "@ourworldindata/components"
import * as db from "../../db/db.js"
import { archieToEnriched } from "../../db/model/Gdoc/archieToEnriched.js"
import { enrichedBlockToRawBlock } from "../../db/model/Gdoc/enrichedToRaw.js"
import { enumerateGdocComponentsWithoutChildren } from "../../db/model/Gdoc/extractGdocComponentInfo.js"
import { resolveBlockAtPath } from "../gdocsReferencePreview.js"
import {
    MinimalBlock,
    applyDraftOverrides,
    minimizeRaw,
    parseDraftOverrides,
    sanitizeLegacySpans,
} from "../gdocsReferenceMinimal.js"
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
            c.type AS componentId,
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
            totalUses: Number(row.totalUses),
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

// An InstanceRow parsed, minimized and signed, before it is trimmed down to
// the ComponentInstance wire shape.
interface ScannedInstance {
    row: InstanceRow
    minimal: MinimalBlock | undefined
    signature: string
}

// A posts_gdocs_components config: the enriched block as stored by
// extractGdocComponentInfo — child blocks omitted, spans flattened to plain
// text strings.
type StoredConfig = Record<string, unknown> & { type: string }

function parseConfig(config: InstanceRow["config"]): StoredConfig | undefined {
    try {
        const parsed = typeof config === "string" ? JSON.parse(config) : config
        if (
            parsed &&
            typeof parsed === "object" &&
            typeof (parsed as { type?: unknown }).type === "string"
        )
            return parsed as StoredConfig
    } catch {
        // fall through — a malformed stored config yields no block
    }
    return undefined
}

/**
 * Reconstruct the raw (authoring-shaped) block from a stored config. The
 * stored form — children omitted, spans flattened to plain strings — is
 * already essentially the raw value shape, which holds strings everywhere;
 * only scalars need stringifying (level: 2 → "2", hasOutline: false →
 * "false").
 */
function configToRaw(config: StoredConfig): OwidRawGdocBlock {
    const { type, parseErrors: _parseErrors, ...props } = config
    // Blocks whose raw form is a plain string value (e.g. text) store it as
    // a lone "value" prop.
    if ("value" in props && Object.keys(props).length === 1)
        return { type, value: props.value } as unknown as OwidRawGdocBlock
    const value: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(props)) {
        if (v === undefined || v === null) continue
        value[key] =
            typeof v === "number" || typeof v === "boolean" ? String(v) : v
    }
    return { type, value } as unknown as OwidRawGdocBlock
}

function minimizeConfig(
    config: StoredConfig | undefined
): MinimalBlock | undefined {
    if (!config) return undefined
    return minimizeRaw(configToRaw(config))
}

/**
 * The minimal ArchieML for a real (fully enriched) block from a document
 * body — used for the source shown next to rendered examples, where the
 * children the stored config omits must be present.
 */
function minimalArchieFromEnriched(
    block: OwidEnrichedGdocBlock | undefined
): string | undefined {
    if (!block) return undefined
    try {
        const minimal = minimizeRaw(
            enrichedBlockToRawBlock(sanitizeLegacySpans(block))
        )
        return OwidRawGdocBlockToArchieMLString(minimal.raw)
    } catch {
        return undefined
    }
}

/**
 * A surviving prop joins the signature by presence ("caption") or — for the
 * component's valueProps, derived by the registry generator from the
 * declared types (literal unions, enums, numbers, booleans) — by value
 * ("size:narrow" is a different form than "size:wide", but two charts with
 * different urls are the same form).
 */
function partsOf(
    minimal: MinimalBlock | undefined,
    valueProps: Set<string>
): string[] {
    if (!minimal) return []
    const parts: string[] = []
    for (const [key, v] of Object.entries(minimal.props)) {
        if (
            valueProps.has(key) &&
            (typeof v === "string" || typeof v === "number")
        )
            parts.push(key + ":" + String(v))
        else parts.push(key)
    }
    return parts.sort()
}

/**
 * Parts present on every minimized instance are the component's required
 * scaffolding (a chart always has a url) — not a variation-defining feature.
 * Exact by construction: after minimization a part only exists where an
 * author's source needs it, so "on every instance" means "part of what the
 * component is". The denominator is every instance whose config parsed —
 * including those with zero surviving parts (a bare callout), which prove a
 * prop is optional — but not malformed configs, which prove nothing.
 */
function universalParts(
    allParts: string[][],
    analyzableCount: number
): Set<string> {
    const counts = new Map<string, number>()
    for (const parts of allParts) {
        for (const part of parts) counts.set(part, (counts.get(part) ?? 0) + 1)
    }
    const universal = new Set<string>()
    if (analyzableCount === 0) return universal
    for (const [part, count] of counts) {
        if (count === analyzableCount) universal.add(part)
    }
    return universal
}

function signatureFromParts(parts: string[], universal: Set<string>): string {
    return parts.filter((part) => !universal.has(part)).join("+")
}

function blockToArchie(minimal: MinimalBlock | undefined): string | undefined {
    if (!minimal) return undefined
    try {
        return OwidRawGdocBlockToArchieMLString(minimal.raw)
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
        if (block?.type === "heading") return convertHeadingTextToId(block.text)
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
    const doc = (componentsRegistry as ComponentRegistry).components.find(
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
            AND c.type = ?
        ORDER BY pg.publishedAt DESC, c.gdocId, c.path
        LIMIT ${SCAN_MAX}`,
        [componentId]
    )

    const parsed = rows.map((row) => ({
        row,
        minimal: minimizeConfig(parseConfig(row.config)),
    }))
    const valueProps = new Set(doc.valueProps ?? [])
    const allParts = parsed.map((instance) =>
        partsOf(instance.minimal, valueProps)
    )
    const analyzableCount = parsed.filter(
        (instance) => instance.minimal !== undefined
    ).length
    const universal = universalParts(allParts, analyzableCount)
    const scanned: ScannedInstance[] = parsed.map(
        ({ row, minimal }, index) => ({
            row,
            minimal,
            signature: signatureFromParts(allParts[index], universal),
        })
    )

    // Per-prop adoption across the scan: a prop is "adopted" by an instance
    // when it survives in its minimal source (required, or deviating from the
    // parser default). A part names its prop before the value separator.
    const propAdoption: Record<string, number> = {}
    for (const parts of allParts) {
        const names = new Set(parts.map((part) => part.split(":")[0]))
        for (const name of names)
            propAdoption[name] = (propAdoption[name] ?? 0) + 1
    }

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
                AND c.type = ?
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
        // The shown source comes from the real block in the document body —
        // the stored config omits child blocks, so its archie would be
        // incomplete for container blocks. Same minimization either way.
        const realBlock = body
            ? resolveBlockAtPath({ body }, instance.path)
            : undefined
        instance.archie =
            minimalArchieFromEnriched(realBlock) ??
            blockToArchie(scannedInstance.minimal)
        return instance
    }

    // Match the sidecar's synthetic examples against production: an example
    // whose form is observed lends the observed variation its curated name;
    // one whose form is not observed is presented by the UI as a synthetic
    // variation ("not used in any published doc yet") — synthetic examples
    // cover exactly the gap reality leaves.
    const syntheticExamples: SyntheticExampleInfo[] = doc.examples.map(
        (example, exampleIndex) => {
            let signature = ""
            try {
                const content = archieToEnriched(
                    `title: example\ntype: fragment\n[+body]\n${example.archie}\n[]\n`
                )
                const blocks = content.body ?? []
                const block =
                    blocks.find((b) => b.type === componentId) ?? blocks[0]
                if (block) {
                    // Flatten the example block exactly like the extraction
                    // pipeline flattens stored configs (children omitted,
                    // spans to plain text), so signatures compare like for
                    // like — including the scan-derived enum props.
                    const [flattened] = enumerateGdocComponentsWithoutChildren(
                        block,
                        "$.body",
                        "$.body[0]"
                    )
                    signature = signatureFromParts(
                        partsOf(
                            minimizeConfig(
                                flattened?.content as StoredConfig | undefined
                            ),
                            valueProps
                        ),
                        universal
                    )
                }
            } catch {
                // an unparsable example has no signature to match
            }
            return {
                exampleIndex,
                name: example.name,
                signature,
                observed: bySignature.has(signature),
            }
        }
    )

    // The curated naming layer: an observed variation takes the name of the
    // (first) sidecar example with the same form. Variations left with a
    // technical label are a visible curation gap — name one by adding a
    // matching example to the sidecar.
    const nameBySignature = new Map<string, string>()
    for (const example of syntheticExamples) {
        // Unnamed examples (no "### " heading in the sidecar) never enter
        // the naming layer — their forms keep the automatic label.
        if (
            example.observed &&
            example.name !== "" &&
            !nameBySignature.has(example.signature)
        )
            nameBySignature.set(example.signature, example.name)
    }

    const variations: ComponentVariation[] = variationGroups.map(
        ([signature, group]) => {
            const name = nameBySignature.get(signature)
            return {
                signature,
                count: group.length,
                representative: present(group[0]),
                ...(name !== undefined && { name }),
            }
        }
    )

    return {
        componentId,
        total,
        instances: pageInstances.map(present),
        variations,
        pinned: pinned.map(present),
        stalePins,
        syntheticExamples,
        // The analyzed population — the denominator behind propAdoption and
        // form frequencies (malformed configs prove nothing about props).
        scanned: analyzableCount,
        propAdoption,
    }
}

// -----------------------------------------------------------------------------
// The form builder: a real instance reshaped by prop overrides
// -----------------------------------------------------------------------------

/**
 * The form builder's draft: the block at ?path in the published gdoc ?gdocId
 * with the author's cycled ?overrides applied, reduced to its minimal source.
 * Returns the ArchieML the author would paste and the surviving props (the
 * client derives the draft's form signature from those).
 */
export async function getComponentDraft(
    req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
): Promise<ComponentDraftResponse> {
    const gdocId = req.query.gdocId as string | undefined
    const path = req.query.path as string | undefined
    if (!gdocId || !path)
        throw new JsonError("gdocId and path are required", 400)
    const overrides = parseDraftOverrides(
        req.query.overrides as string | undefined
    )
    if (!overrides) throw new JsonError("No valid overrides given", 400)

    const bodies = await loadBodies(trx, [gdocId])
    const body = bodies.get(gdocId)
    const block = body ? resolveBlockAtPath({ body }, path) : undefined
    if (!block)
        throw new JsonError(
            `No renderable block at "${path}" in gdoc "${gdocId}"`,
            404
        )

    const draft = applyDraftOverrides(block, overrides)
    const archie = draft ? blockToArchie(draft) : undefined
    if (!draft || archie === undefined)
        throw new JsonError("This block has no properties to shape", 400)
    return { archie, props: draft.props }
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
    if (!template) throw new JsonError(`No such template: "${templateId}"`, 404)

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
