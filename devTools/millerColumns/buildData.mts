// Builds the data for the Miller-columns prototype: one canonical tree for the
// whole site (every node has exactly one parent), plus a link index so links
// can point at a canonical place instead of growing the tree.
//
// Run: yarn tsx --tsconfig tsconfig.tsx.json devTools/millerColumns/buildData.mts

import fs from "node:fs"
import path from "node:path"
import mysql from "mysql2/promise"
// The file, not the package: its index pulls in archieml, which ESM cannot load.
import { parseFaqs } from "../../packages/@ourworldindata/gdoc-pipeline/src/rawToEnriched.js"
import {
    formatSourceDate,
    getLastUpdatedFromVariable,
    getNextUpdateFromVariable,
} from "@ourworldindata/utils"
import {
    GRAPHER_DB_HOST,
    GRAPHER_DB_NAME,
    GRAPHER_DB_PASS,
    GRAPHER_DB_PORT,
    GRAPHER_DB_USER,
} from "../../settings/serverSettings.js"

type Span = string | { t: string; l: number }
type Link = { text: string; target?: string; url?: string; kind: string }

interface TreeNode {
    id: string
    kind: string
    title: string
    parent?: string
    children?: string[]
    // A secondary parent places a node in a second spot of the DAG. It is
    // shown there as an alias that jumps to the canonical place.
    alsoIn?: string[]
    spans?: Span[]
    items?: Span[][]
    links?: Link[]
    level?: number
    thumb?: string
    url?: string
    date?: string
    target?: string
    dimension?: string // the MDM dimension a view-tree node picks a choice for
    // For a chart nobody uses: charts of the same data in other topics.
    sameData?: string[]
    // 0–1 popularity score; only comparable between items of one kind.
    pop?: number
}

const OWID = "https://ourworldindata.org"
const IMAGES =
    "https://ourworldindata.org/cdn-cgi/imagedelivery/qLq-8BTgXU8yG0N6HnOy8g"

// The database in .env; STAGING=1 reads this branch's staging server.
const db = await mysql.createConnection({
    host: GRAPHER_DB_HOST,
    port: GRAPHER_DB_PORT,
    user: GRAPHER_DB_USER,
    password: GRAPHER_DB_PASS,
    database: GRAPHER_DB_NAME,
})
async function q<T>(sql: string): Promise<T[]> {
    const [rows] = await db.query(sql)
    return rows as T[]
}

const nodes = new Map<string, TreeNode>()
function add(node: TreeNode): TreeNode {
    nodes.set(node.id, node)
    return node
}
function attach(parentId: string, childId: string): void {
    const parent = nodes.get(parentId)!
    ;(parent.children ??= []).push(childId)
    nodes.get(childId)!.parent = parentId
}

// --- Topics: the tag graph is a DAG; keep its heaviest edge as canonical ---

const tags = await q<{ id: number; name: string; slug: string | null }>(
    "SELECT id, name, slug FROM tags"
)
const tagById = new Map(tags.map((t) => [t.id, t]))
const edges = await q<{ parentId: number; childId: number; weight: number }>(
    "SELECT parentId, childId, weight FROM tag_graph ORDER BY weight DESC, parentId"
)
const root = tags.find((t) => t.name === "tag-graph-root")!
add({ id: "root", kind: "root", title: "Our World in Data" })

const tagDepth = new Map<number, number>([[root.id, 0]])
const parentsOf = new Map<number, typeof edges>()
for (const e of edges) {
    if (!parentsOf.has(e.childId)) parentsOf.set(e.childId, [])
    parentsOf.get(e.childId)!.push(e)
}
// Breadth-first so a tag's canonical parent is always placed before it.
let frontier = [root.id]
while (frontier.length) {
    const next: number[] = []
    for (const parentId of frontier) {
        const children = edges.filter((e) => e.parentId === parentId)
        for (const e of children) {
            if (tagDepth.has(e.childId)) continue
            // Heaviest edge among parents already placed.
            const canonical = parentsOf
                .get(e.childId)!
                .find((p) => tagDepth.has(p.parentId))!
            if (canonical.parentId !== parentId) continue
            tagDepth.set(e.childId, tagDepth.get(parentId)! + 1)
            next.push(e.childId)
        }
    }
    frontier = next
}
const tagNodeId = (id: number): string =>
    id === root.id ? "root" : `topic:${id}`
for (const [id, depth] of [...tagDepth].sort((a, b) => a[1] - b[1])) {
    if (id === root.id) continue
    const tag = tagById.get(id)!
    add({
        id: tagNodeId(id),
        kind: depth === 1 ? "area" : "topic",
        title: tag.name,
        url: tag.slug ? `${OWID}/${tag.slug}` : undefined,
    })
}
for (const [id] of [...tagDepth].sort((a, b) => a[1] - b[1])) {
    if (id === root.id) continue
    const [canonical, ...others] = parentsOf.get(id)!
    attach(tagNodeId(canonical.parentId), tagNodeId(id))
    const secondary = others.filter((p) => tagDepth.has(p.parentId))
    if (secondary.length)
        nodes.get(tagNodeId(id))!.alsoIn = secondary.map((p) =>
            tagNodeId(p.parentId)
        )
}

// An item tagged with several topics lives under the most specific one.
function canonicalTopic(tagIds: number[]): string {
    const placed = tagIds.filter((id) => tagDepth.has(id))
    if (!placed.length) return "unfiled"
    placed.sort((a, b) => tagDepth.get(b)! - tagDepth.get(a)! || a - b)
    return tagNodeId(placed[0])
}
function otherTopics(tagIds: number[], canonical: string): string[] {
    return tagIds
        .filter((id) => tagDepth.has(id))
        .map(tagNodeId)
        .filter((id) => id !== canonical)
}
add({ id: "unfiled", kind: "topic", title: "Not in a topic" })
attach("root", "unfiled")

// --- Charts ---

const charts = await q<{
    id: number
    slug: string
    title: string
    publishedAt: Date | null
}>(`SELECT c.id, cc.slug, cc.config->>'$.title' title, c.publishedAt
    FROM charts c JOIN chart_configs cc ON cc.id = c.configId
    WHERE cc.config->>'$.isPublished' = 'true'`)
const chartTags = await q<{
    chartId: number
    tagId: number
    keyChartLevel: number
}>(
    "SELECT chartId, tagId, keyChartLevel FROM chart_tags ORDER BY keyChartLevel DESC"
)
const tagsByChart = new Map<number, number[]>()
for (const ct of chartTags) {
    if (!tagsByChart.has(ct.chartId)) tagsByChart.set(ct.chartId, [])
    tagsByChart.get(ct.chartId)!.push(ct.tagId)
}
// Resolves grapher slugs (including old ones) to a node id.
const grapherSlugs = new Map<string, string>()
for (const c of charts) {
    const id = `chart:${c.id}`
    add({
        id,
        kind: "chart",
        title: c.title || c.slug,
        thumb: `${OWID}/grapher/${c.slug}.png`,
        url: `${OWID}/grapher/${c.slug}`,
        date: c.publishedAt?.toISOString().slice(0, 10),
    })
    grapherSlugs.set(c.slug, id)
}
for (const r of await q<{ slug: string; chart_id: number }>(
    "SELECT slug, chart_id FROM chart_slug_redirects"
))
    if (nodes.has(`chart:${r.chart_id}`) && !grapherSlugs.has(r.slug))
        grapherSlugs.set(r.slug, `chart:${r.chart_id}`)

// --- Multi-dimensional data pages: views nest dimension by dimension ---

interface MdmConfig {
    title: { title: string }
    topicTags?: string[]
    dimensions: {
        slug: string
        name: string
        choices: { slug: string; name: string }[]
    }[]
    views: {
        dimensions: Record<string, string>
        indicators?: { y?: { id: number }[] }
    }[]
}
const tagIdByName = new Map(tags.map((t) => [t.name, t.id]))
const mdms = await q<{ id: number; slug: string; config: MdmConfig }>(
    "SELECT id, slug, config FROM multi_dim_data_pages WHERE published = 1"
)
const mdmViewNode = new Map<string, string>() // "slug?a=b&c=d" -> node id
const indicatorOf = new Map<string, number>() // chart or view -> its indicator
for (const mdm of mdms) {
    const mdmId = `mdm:${mdm.id}`
    add({
        id: mdmId,
        kind: "mdm",
        title: mdm.config.title.title,
        url: `${OWID}/grapher/${mdm.slug}`,
        thumb: `${OWID}/grapher/${mdm.slug}.png`,
    })
    grapherSlugs.set(mdm.slug, mdmId)
    const tagIds = (mdm.config.topicTags ?? [])
        .map((n) => tagIdByName.get(n))
        .filter((id): id is number => id !== undefined)
    const topic = canonicalTopic(tagIds)
    attach(topic, mdmId)
    const also = otherTopics(tagIds, topic)
    if (also.length) nodes.get(mdmId)!.alsoIn = also

    const dims = mdm.config.dimensions
    for (const view of mdm.config.views) {
        let parentId = mdmId
        dims.forEach((dim, i) => {
            const choiceSlug = view.dimensions[dim.slug]
            const choice = dim.choices.find((c) => c.slug === choiceSlug)
            const prefix = dims
                .slice(0, i + 1)
                .map((d) => `${d.slug}=${view.dimensions[d.slug]}`)
                .join("&")
            const id = `${mdmId}?${prefix}`
            const isLeaf = i === dims.length - 1
            if (!nodes.has(id)) {
                add({
                    id,
                    kind: isLeaf ? "view" : "dimension",
                    title: choice?.name ?? choiceSlug,
                    dimension: dim.name,
                    thumb: isLeaf
                        ? `${OWID}/grapher/${mdm.slug}.png?${prefix}`
                        : undefined,
                    url: `${OWID}/grapher/${mdm.slug}?${prefix}`,
                })
                attach(parentId, id)
            }
            parentId = id
        })
        const full = dims
            .map((d) => `${d.slug}=${view.dimensions[d.slug]}`)
            .sort()
            .join("&")
        mdmViewNode.set(`${mdm.slug}?${full}`, parentId)
        const indicator = view.indicators?.y?.[0]?.id
        if (indicator) indicatorOf.set(parentId, indicator)
    }
}

// Charts are attached after MDMs so a topic lists its collections first.
for (const c of charts) {
    const tagIds = tagsByChart.get(c.id) ?? []
    const topic = canonicalTopic(tagIds)
    attach(topic, `chart:${c.id}`)
    const also = otherTopics(tagIds, topic)
    if (also.length) nodes.get(`chart:${c.id}`)!.alsoIn = also
}

// --- Explorers ---

const explorerSlugs = new Map<string, string>()
const explorers = await q<{ slug: string; title: string }>(
    `SELECT slug, config->>'$.explorerTitle' title FROM explorers WHERE isPublished = 1`
)
const explorerTags = await q<{ explorerSlug: string; tagId: number }>(
    "SELECT explorerSlug, tagId FROM explorer_tags"
)
for (const e of explorers) {
    const id = `explorer:${e.slug}`
    add({
        id,
        kind: "explorer",
        title: e.title || e.slug,
        url: `${OWID}/explorers/${e.slug}`,
        thumb: `${OWID}/explorers/${e.slug}.png`,
    })
    explorerSlugs.set(e.slug, id)
    const tagIds = explorerTags
        .filter((t) => t.explorerSlug === e.slug)
        .map((t) => t.tagId)
    const topic = canonicalTopic(tagIds)
    attach(topic, id)
}

// --- Narrative charts live under the chart they were derived from ---

const narratives = await q<{
    name: string
    title: string
    parentChartId: number | null
    queryParamsForParentChart: Record<string, string> | null
}>(`SELECT nc.name, cc.config->>'$.title' title, nc.parentChartId,
        nc.queryParamsForParentChart
    FROM narrative_charts nc JOIN chart_configs cc ON cc.id = nc.chartConfigId`)
const narrativeByName = new Map<string, string>()
for (const n of narratives) {
    const parent = n.parentChartId ? `chart:${n.parentChartId}` : undefined
    if (!parent || !nodes.has(parent)) continue
    const params = n.queryParamsForParentChart
        ? new URLSearchParams(
              Object.entries(n.queryParamsForParentChart)
          ).toString()
        : ""
    const parentUrl = nodes.get(parent)!.url!
    const id = `narrative:${n.name}`
    add({
        id,
        kind: "narrative-chart",
        title: n.title || n.name,
        thumb: `${parentUrl}.png${params ? "?" + params : ""}`,
        url: parentUrl + (params ? "?" + params : ""),
    })
    attach(parent, id)
    narrativeByName.set(n.name, id)
}

// --- Gdocs: articles, data insights, topic pages ---

const gdocs = await q<{
    id: string
    slug: string
    type: string
    title: string
    publishedAt: Date | null
    body: string | null
    grapherUrl: string | null
    narrativeChart: string | null
}>(`SELECT id, slug, type, content->>'$.title' title, publishedAt,
        JSON_EXTRACT(content, '$.body') body,
        content->>'$."grapher-url"' grapherUrl,
        content->>'$."narrative-chart"' narrativeChart
    FROM posts_gdocs
    WHERE published = 1
      AND type IN ('article','data-insight','topic-page','linear-topic-page')
    ORDER BY publishedAt DESC`)
const gdocTags = await q<{ gdocId: string; tagId: number }>(
    "SELECT gdocId, tagId FROM posts_gdocs_x_tags"
)
const gdocById = new Map<string, string>()
const gdocBySlug = new Map<string, string>()
const tagIdBySlug = new Map(
    tags.filter((t) => t.slug).map((t) => [t.slug!, t.id])
)
for (const g of gdocs) {
    const id = `doc:${g.id}`
    add({
        id,
        kind: g.type,
        title: g.title,
        url:
            g.type === "data-insight"
                ? `${OWID}/data-insights/${g.slug}`
                : `${OWID}/${g.slug}`,
        date: g.publishedAt?.toISOString().slice(0, 10),
    })
    gdocById.set(g.id, id)
    if (g.type !== "data-insight") gdocBySlug.set(g.slug, id)
    else gdocBySlug.set(`data-insights/${g.slug}`, id)
    // A topic page is the overview of its own topic.
    const ownTag = tagIdBySlug.get(g.slug)
    const isTopicPage = g.type.endsWith("topic-page")
    if (isTopicPage && ownTag && tagDepth.has(ownTag)) {
        const topic = nodes.get(tagNodeId(ownTag))!
        attach(topic.id, id)
        // Keep the overview first among the topic's own content.
        topic.children = [
            ...topic.children!.filter((c) => c.startsWith("topic:")),
            id,
            ...topic.children!.filter(
                (c) => !c.startsWith("topic:") && c !== id
            ),
        ]
        continue
    }
    const tagIds = gdocTags.filter((t) => t.gdocId === g.id).map((t) => t.tagId)
    const topic = canonicalTopic(tagIds)
    attach(topic, id)
    const also = otherTopics(tagIds, topic)
    if (also.length) nodes.get(id)!.alsoIn = also
}

// Order a topic: overview, subtopics, articles, insights, data.
const kindOrder = [
    "topic-page",
    "linear-topic-page",
    "area",
    "topic",
    "article",
    "data-insight",
    "mdm",
    "explorer",
    "chart",
]
for (const n of nodes.values()) {
    if (n.kind !== "topic" && n.kind !== "area" && n.kind !== "root") continue
    n.children?.sort(
        (a, b) =>
            kindOrder.indexOf(nodes.get(a)!.kind) -
            kindOrder.indexOf(nodes.get(b)!.kind)
    )
}

// --- Link resolution: every URL points at one canonical node ---

function resolve(rawUrl: string): { target?: string; url?: string } {
    const url = rawUrl.trim()
    const gdocMatch = url.match(/docs\.google\.com\/document\/d\/([\w-]+)/)
    if (gdocMatch) {
        const target = gdocById.get(gdocMatch[1])
        return target ? { target } : { url }
    }
    let parsed: URL
    try {
        parsed = new URL(url, OWID)
    } catch {
        return { url }
    }
    if (!parsed.hostname.endsWith("ourworldindata.org")) return { url }
    const p = parsed.pathname.replace(/^\/|\/$/g, "")
    const grapher = p.match(/^grapher\/([\w-]+)/)
    if (grapher) {
        const slug = grapher[1]
        const base = grapherSlugs.get(slug)
        if (base?.startsWith("mdm:")) {
            const params = [...parsed.searchParams].filter(
                ([k]) => !["country", "tab", "hideControls", "time"].includes(k)
            )
            const key = `${slug}?${params
                .map(([k, v]) => `${k}=${v}`)
                .sort()
                .join("&")}`
            return { target: mdmViewNode.get(key) ?? base }
        }
        return base ? { target: base } : { url }
    }
    const explorer = p.match(/^explorers\/([\w-]+)/)
    if (explorer)
        return explorerSlugs.has(explorer[1])
            ? { target: explorerSlugs.get(explorer[1]) }
            : { url }
    const doc = gdocBySlug.get(p)
    return doc ? { target: doc } : { url }
}

// --- Document model: headings nest, everything else is a readable leaf ---

type RawSpan = {
    spanType: string
    text?: string
    url?: string
    children?: RawSpan[]
}
type RawBlock = Record<string, unknown> & { type: string }

function spanText(spans: RawSpan[]): string {
    return spans
        .map((s) =>
            s.spanType === "span-ref"
                ? ""
                : s.text !== undefined
                  ? s.text
                  : spanText(s.children ?? [])
        )
        .join("")
}
// Quotes and expandable paragraphs nest their text in a few different shapes.
function toSpanLists(x: unknown): RawSpan[][] {
    if (typeof x === "string")
        return [[{ spanType: "span-simple-text", text: x }]]
    if (Array.isArray(x)) {
        if (x.every((el) => el && typeof el === "object" && "spanType" in el))
            return [x as RawSpan[]]
        return x.flatMap(toSpanLists)
    }
    if (x && typeof x === "object" && (x as RawBlock).type === "text")
        return [(x as { value: RawSpan[] }).value]
    return []
}
function flattenSpans(spans: RawSpan[], links: Link[]): Span[] {
    const out: Span[] = []
    for (const s of spans) {
        if (s.spanType === "span-ref") continue // footnote markers
        if (s.spanType === "span-link" && s.url) {
            const text = spanText(s.children ?? [])
            const resolved = resolve(s.url)
            if (s.url.startsWith("#")) {
                out.push(text)
                continue
            }
            const kind = resolved.target
                ? nodes.get(resolved.target)!.kind
                : "external"
            links.push({ text, kind, ...resolved })
            out.push({ t: text, l: links.length - 1 })
            continue
        }
        if (s.text !== undefined) out.push(s.text)
        else out.push(...flattenSpans(s.children ?? [], links))
    }
    return out
}

// target -> the blocks that point at it, with enough text to show the
// reference without loading the referencing document.
const references: Record<
    string,
    {
        from: string
        doc: string
        text: string
        snippet: string
        section?: string
    }[]
> = {}
function addReference(
    target: string | undefined,
    from: string,
    text: string
): void {
    if (!target) return
    const block = nodes.get(from)!
    const plain = block.spans
        ? block.spans.map((x) => (typeof x === "string" ? x : x.t)).join("")
        : block.items
          ? block.items
                .map((i) =>
                    i.map((x) => (typeof x === "string" ? x : x.t)).join("")
                )
                .join(" · ")
          : ""
    const at = Math.max(0, plain.indexOf(text) - 70)
    const snippet =
        (at > 0 ? "…" : "") +
        plain.slice(at, at + 200) +
        (plain.length > at + 200 ? "…" : "")
    // The nearest heading tells apart two references from the same document.
    let section: string | undefined
    for (let at = block.parent; at && !section; at = nodes.get(at)?.parent) {
        const n = nodes.get(at)
        if (n?.kind === "heading") section = n.title
    }
    ;(references[target] ??= []).push({
        from,
        doc: from.split("#")[0],
        text,
        snippet,
        section,
    })
}

// Block ids number a document's blocks in reading order ("doc#1", "doc#2", …).
const blockCounts = new Map<string, number>()
function newBlockId(docId: string): string {
    const n = (blockCounts.get(docId) ?? 0) + 1
    blockCounts.set(docId, n)
    return `${docId}#${n}`
}

// `under` places the blocks below one of the document's blocks (a data page's
// FAQ section) instead of at its top.
function buildBody(docId: string, body: RawBlock[], under = docId): void {
    const stack: { level: number; id: string }[] = [{ level: 0, id: under }]
    const parentFor = (): string => stack[stack.length - 1].id
    const newId = (): string => newBlockId(docId)

    function addBlock(b: RawBlock): void {
        switch (b.type) {
            case "heading": {
                const level = b.level as number
                while (stack[stack.length - 1].level >= level) stack.pop()
                const id = newId()
                add({
                    id,
                    kind: "heading",
                    level,
                    title: spanText(b.text as RawSpan[]),
                })
                attach(parentFor(), id)
                stack.push({ level, id })
                return
            }
            case "text":
            case "blockquote":
            case "pull-quote":
            case "expandable-paragraph": {
                const raw =
                    b.type === "text"
                        ? [b.value as RawSpan[]]
                        : toSpanLists(b.text ?? b.items)
                for (const spans of raw) {
                    const links: Link[] = []
                    const flat = flattenSpans(spans, links)
                    const plain = flat
                        .map((x) => (typeof x === "string" ? x : x.t))
                        .join("")
                    if (!plain.trim()) continue
                    const id = newId()
                    add({
                        id,
                        kind: b.type === "text" ? "paragraph" : "quote",
                        title: "",
                        spans: flat,
                        links: links.length ? links : undefined,
                    })
                    attach(parentFor(), id)
                    for (const l of links) addReference(l.target, id, l.text)
                }
                return
            }
            case "list":
            case "numbered-list": {
                const links: Link[] = []
                const items = (b.items as { value: RawSpan[] }[]).map((i) =>
                    flattenSpans(i.value, links)
                )
                const id = newId()
                add({
                    id,
                    kind: "list",
                    title: "",
                    items,
                    links: links.length ? links : undefined,
                })
                attach(parentFor(), id)
                for (const l of links) addReference(l.target, id, l.text)
                return
            }
            case "chart":
            case "narrative-chart": {
                const resolved =
                    b.type === "chart"
                        ? resolve(b.url as string)
                        : { target: narrativeByName.get(b.name as string) }
                const target = resolved.target
                const targetNode = target ? nodes.get(target) : undefined
                const query =
                    b.type === "chart" ? (b.url as string).split("?")[1] : ""
                const id = newId()
                add({
                    id,
                    kind: "embed",
                    title: targetNode?.title ?? (b.url as string) ?? "Chart",
                    target,
                    // The live chart: exactly what the article embeds.
                    url:
                        b.type === "chart"
                            ? new URL(b.url as string, OWID).href
                            : targetNode?.url,
                    thumb:
                        targetNode?.kind === "chart" && query
                            ? `${targetNode.thumb}?${query}`
                            : targetNode?.thumb,
                    links: target
                        ? [
                              {
                                  text: targetNode!.title,
                                  target,
                                  kind: targetNode!.kind,
                              },
                          ]
                        : undefined,
                })
                attach(parentFor(), id)
                addReference(target, id, "embedded")
                return
            }
            case "image": {
                const filename = (b.smallFilename ?? b.filename) as string
                if (!imageIds.has(filename)) return
                const id = newId()
                add({
                    id,
                    kind: "image",
                    title: (b.alt as string) || filename,
                    thumb: `${IMAGES}/${imageIds.get(filename)}/w=800`,
                })
                attach(parentFor(), id)
                return
            }
            case "callout":
            case "aside":
            case "gray-section":
            case "sticky-right":
            case "sticky-left":
            case "side-by-side":
            case "expander":
            case "key-insights": {
                // Layout containers are not part of the reading hierarchy:
                // their content reads in place.
                for (const key of [
                    "text",
                    "items",
                    "left",
                    "right",
                    "content",
                    "insights",
                    "blocks",
                ]) {
                    const inner = b[key]
                    if (!Array.isArray(inner)) continue
                    for (const x of inner as RawBlock[]) {
                        if (x && typeof x === "object" && "type" in x)
                            addBlock(x)
                        else if (x && typeof x === "object" && "content" in x)
                            for (const y of (x as { content: RawBlock[] })
                                .content)
                                addBlock(y)
                    }
                }
                return
            }
            case "prominent-link": {
                const resolved = resolve(b.url as string)
                const targetNode = resolved.target
                    ? nodes.get(resolved.target)
                    : undefined
                const title =
                    (b.title as string) ||
                    targetNode?.title ||
                    (b.url as string)
                const id = newId()
                add({
                    id,
                    kind: "prominent-link",
                    title,
                    target: resolved.target,
                    links: [
                        {
                            text: title,
                            kind: targetNode?.kind ?? "external",
                            ...resolved,
                        },
                    ],
                })
                attach(parentFor(), id)
                addReference(resolved.target, id, title)
                return
            }
            case "topic-page-intro":
                for (const c of b.content as RawBlock[]) addBlock(c)
                return
            default:
                return // ToC widgets, CTAs, HTML embeds etc. carry no reading content
        }
    }
    for (const b of body) addBlock(b)
}

const imageIds = new Map(
    (
        await q<{ filename: string; cloudflareId: string }>(
            "SELECT filename, cloudflareId FROM images WHERE cloudflareId IS NOT NULL"
        )
    ).map((i) => [i.filename, i.cloudflareId])
)
// A data insight's figure is the chart it names, embedded in place of its
// static image, so the insight leads to the chart and the chart lists it.
function insightFigure(g: (typeof gdocs)[number]): RawBlock | undefined {
    if (g.narrativeChart && narrativeByName.has(g.narrativeChart))
        return { type: "narrative-chart", name: g.narrativeChart }
    // Some insights name their chart by its admin edit link.
    const adminId = g.grapherUrl?.match(/\/admin\/charts\/(\d+)/)?.[1]
    const url = adminId ? nodes.get(`chart:${adminId}`)?.url : g.grapherUrl
    return url && resolve(url).target ? { type: "chart", url } : undefined
}
for (const g of gdocs) {
    if (!g.body) continue
    let body = (
        typeof g.body === "string" ? JSON.parse(g.body) : g.body
    ) as RawBlock[]
    const figure = g.type === "data-insight" ? insightFigure(g) : undefined
    if (figure) {
        const image = body.findIndex((b) => b.type === "image")
        body = image >= 0 ? body.with(image, figure) : [figure, ...body]
    }
    buildBody(`doc:${g.id}`, body)
}

// --- Data pages: a chart or view's home reads like a short document ---

// Only charts in the `datapages` view render as data pages on the site; the
// rest are plain grapher pages (the chart alone), so they get no metadata here.
// MDM views always render as data pages.
for (const d of await q<{ chartId: number; variableId: number }>(
    "SELECT chartId, variableId FROM datapages"
))
    indicatorOf.set(`chart:${d.chartId}`, d.variableId)

const indicatorIds = [...new Set(indicatorOf.values())]
const inIndicators = `(${indicatorIds.join(",") || "NULL"})`
const variables = new Map(
    (
        await q<{
            id: number
            unit: string | null
            timespan: string | null
            catalogPath: string | null
            attribution: string | null
            updatePeriodDays: number | null
            descriptionShort: string | null
            descriptionKey: string[] | string | null
            descriptionFromProducer: string | null
            descriptionProcessing: string | null
        }>(`SELECT v.id, COALESCE(v.display->>'$.unit', v.unit) unit,
            v.timespan, v.catalogPath, v.attribution, d.updatePeriodDays,
            v.descriptionShort, v.descriptionKey, v.descriptionFromProducer,
            v.descriptionProcessing
            FROM variables v JOIN datasets d ON d.id = v.datasetId
            WHERE v.id IN ${inIndicators}`)
    ).map((v) => [v.id, v])
)
type Origin = {
    producer: string
    title: string
    attributionShort: string | null
    description: string | null
    citationFull: string | null
    urlMain: string | null
    datePublished: string | null
    dateAccessed: string | undefined
}
const originsOf = new Map<number, Origin[]>()
for (const o of await q<
    Omit<Origin, "dateAccessed"> & {
        variableId: number
        titleSnapshot: string | null
        dateAccessed: Date | null
    }
>(`SELECT ov.variableId, o.producer, o.title, o.titleSnapshot,
        o.attributionShort, o.description, o.citationFull, o.urlMain,
        o.datePublished, o.dateAccessed
    FROM origins_variables ov JOIN origins o ON o.id = ov.originId
    WHERE ov.variableId IN ${inIndicators}
    ORDER BY ov.displayOrder`)) {
    if (!originsOf.has(o.variableId)) originsOf.set(o.variableId, [])
    originsOf.get(o.variableId)!.push({
        ...o,
        title: o.title ?? o.titleSnapshot ?? "",
        dateAccessed: o.dateAccessed?.toISOString().slice(0, 10),
    })
}

// FAQs live in fragment gdocs; each indicator picks some by fragment id.
const faqRows = await q<{
    variableId: number
    gdocId: string
    fragmentId: string
    faqs: unknown
}>(`SELECT f.variableId, f.gdocId, f.fragmentId,
        JSON_EXTRACT(g.content, '$.faqs') faqs
    FROM posts_gdocs_variables_faqs f JOIN posts_gdocs g ON g.id = f.gdocId
    WHERE f.variableId IN ${inIndicators}
    ORDER BY f.displayOrder`)
const faqsByGdoc = new Map(
    faqRows.map((r) => [r.gdocId, parseFaqs(r.faqs, r.gdocId).faqs])
)
const faqsOf = new Map<number, RawBlock[]>()
for (const r of faqRows) {
    const content = faqsByGdoc.get(r.gdocId)?.[r.fragmentId]?.content
    if (!content) continue
    if (!faqsOf.has(r.variableId)) faqsOf.set(r.variableId, [])
    faqsOf.get(r.variableId)!.push(...(content as RawBlock[]))
}

// Metadata text is markdown: keep its links, drop the rest of the syntax.
function markdownSpans(md: string, links: Link[]): Span[] {
    const out: Span[] = []
    let last = 0
    for (const m of md.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
        out.push(md.slice(last, m.index))
        const [, text, url] = m
        if (url.startsWith("#")) out.push(text) // details on demand
        else {
            const resolved = resolve(url)
            const kind = resolved.target
                ? nodes.get(resolved.target)!.kind
                : "external"
            links.push({ text, kind, ...resolved })
            out.push({ t: text, l: links.length - 1 })
        }
        last = m.index + m[0].length
    }
    out.push(md.slice(last))
    return out
        .map((x) => (typeof x === "string" ? x.replace(/\*\*|__/g, "") : x))
        .filter((x) => x !== "")
}
// Key info comes as an array of bullets, or one string of "- " lines.
function keyBullets(key: string[] | string | null): string[] {
    return [key ?? []]
        .flat()
        .flatMap((k) => k.split(/\n(?=- )/))
        .map((k) => k.replace(/^- /, "").trim())
        .filter(Boolean)
}

// A data page reads like the site's: the chart, its key facts, then the
// sections of its metadata box. A plain grapher page is the chart alone.
function buildDataPage(ownerId: string): void {
    const owner = nodes.get(ownerId)!
    const variable = variables.get(indicatorOf.get(ownerId) ?? -1)
    // Variants (narrative charts) follow the data page.
    const variants = owner.children ?? []
    owner.children = []
    const block = (parent: string, n: Omit<TreeNode, "id">): string => {
        const id = newBlockId(ownerId)
        add({ id, ...n })
        attach(parent, id)
        // The figure is the chart at home, not a use of it.
        if (n.kind !== "embed")
            for (const l of n.links ?? []) addReference(l.target, id, l.text)
        return id
    }
    const section = (title: string, level = 2): string =>
        block(ownerId, { kind: "heading", level, title })
    // Markdown fields hold paragraphs separated by blank lines.
    const paragraphs = (parent: string, md: string | null): void => {
        for (const p of (md ?? "")
            .split(/\n\s*\n/)
            .map((x) => x.trim())
            .filter(Boolean)) {
            const links: Link[] = []
            const spans = markdownSpans(p, links)
            block(parent, {
                kind: "paragraph",
                title: "",
                spans,
                links: links.length ? links : undefined,
            })
        }
    }
    const list = (parent: string, mdItems: string[]): void => {
        if (!mdItems.length) return
        const links: Link[] = []
        const items = mdItems.map((b) => markdownSpans(b, links))
        block(parent, {
            kind: "list",
            title: "",
            items,
            links: links.length ? links : undefined,
        })
    }

    // The chart itself, the same figure an article embeds.
    block(ownerId, {
        kind: "embed",
        title: owner.title,
        target: ownerId,
        thumb: owner.thumb,
        url: owner.url,
        links: [{ text: owner.title, target: ownerId, kind: owner.kind }],
    })
    if (!variable) {
        owner.children.push(...variants)
        return
    }
    const origins = originsOf.get(variable.id) ?? []

    paragraphs(ownerId, variable.descriptionShort)
    const lastUpdated = getLastUpdatedFromVariable({
        catalogPath: variable.catalogPath ?? undefined,
        origins: origins.map((o) => ({ dateAccessed: o.dateAccessed })),
    })
    const nextUpdate = getNextUpdateFromVariable({
        catalogPath: variable.catalogPath ?? undefined,
        updatePeriodDays: variable.updatePeriodDays ?? undefined,
    })
    const dataSource =
        variable.attribution ??
        [...new Set(origins.map((o) => o.producer))].join("; ")
    list(
        ownerId,
        [
            dataSource && `Data source: ${dataSource}`,
            variable.unit && `Unit: ${variable.unit}`,
            variable.timespan && `Date range: ${variable.timespan}`,
            lastUpdated &&
                `Last updated: ${formatSourceDate(lastUpdated, "MMMM D, YYYY")}`,
            nextUpdate &&
                `Next expected update: ${formatSourceDate(nextUpdate, "MMMM YYYY")}`,
        ].filter((x): x is string => !!x)
    )

    const bullets = keyBullets(variable.descriptionKey)
    if (bullets.length)
        list(section("What you should know about this data"), bullets)

    const faqs = faqsOf.get(variable.id)
    if (faqs) buildBody(ownerId, faqs, section("Frequently asked questions"))

    if (variable.descriptionProcessing)
        paragraphs(
            section("How did Our World in Data process this data?"),
            variable.descriptionProcessing
        )

    if (variable.descriptionFromProducer)
        paragraphs(
            section("Documentation from data sources"),
            variable.descriptionFromProducer
        )

    if (origins.length) {
        const sources = section("Data sources")
        for (const o of origins) {
            const year = o.datePublished?.slice(0, 4)
            const name = [o.producer, o.title].filter(Boolean).join(" – ")
            const source = block(sources, {
                kind: "heading",
                level: 3,
                title: year ? `${name} (${year})` : name,
            })
            paragraphs(source, o.description)
            list(
                source,
                [
                    o.dateAccessed &&
                        `Retrieved on: ${formatSourceDate(o.dateAccessed, "MMMM D, YYYY")}`,
                    o.urlMain && `Retrieved from: [${o.urlMain}](${o.urlMain})`,
                ].filter((x): x is string => !!x)
            )
            paragraphs(source, o.citationFull && `Citation: ${o.citationFull}`)
        }
    }
    owner.children.push(...variants)
}
for (const n of [...nodes.values()])
    if (n.kind === "chart" || n.kind === "view") buildDataPage(n.id)

// Drop empty topics so every column leads somewhere.
function prune(id: string): boolean {
    const n = nodes.get(id)!
    if (n.kind !== "topic" && n.kind !== "area") return true
    n.children = (n.children ?? []).filter(prune)
    if (n.children.length) return true
    nodes.delete(id)
    return false
}
nodes.get("root")!.children = nodes.get("root")!.children!.filter(prune)
for (const n of nodes.values())
    if (n.alsoIn) n.alsoIn = n.alsoIn.filter((id) => nodes.has(id))

// --- Same data, other topics: a way out for charts nobody uses ---

// Charts sharing a plotted indicator (x or y, not size or color, which
// link unrelated scatters through population or continent). The tree
// already shows the same topic, so only other topics count. A shared
// indicator weighs less the more charts use it, so GDP per capita, used by
// a hundred scatters, doesn't drown out the specific match.
const chartsByIndicator = new Map<number, string[]>()
for (const d of await q<{ chartId: number; variableId: number }>(
    `SELECT DISTINCT chartId, variableId FROM chart_dimensions
    WHERE property IN ('x', 'y')`
)) {
    const id = `chart:${d.chartId}`
    if (!nodes.has(id)) continue
    if (!chartsByIndicator.has(d.variableId))
        chartsByIndicator.set(d.variableId, [])
    chartsByIndicator.get(d.variableId)!.push(id)
}
const SAME_DATA_SHOWN = 3
const scores = new Map<string, Map<string, number>>()
for (const ids of chartsByIndicator.values())
    for (const a of ids)
        for (const b of ids) {
            if (a === b) continue
            if (!scores.has(a)) scores.set(a, new Map())
            const s = scores.get(a)!
            s.set(b, (s.get(b) ?? 0) + 1 / ids.length)
        }
for (const [id, s] of scores) {
    const chart = nodes.get(id)!
    if (references[id]) continue
    const elsewhere = [...s]
        .filter(([other]) => nodes.get(other)!.parent !== chart.parent)
        .sort((a, b) => b[1] - a[1])
        .slice(0, SAME_DATA_SHOWN)
        .map(([other]) => other)
    if (elsewhere.length) chart.sameData = elsewhere
}

// The skeleton (topics, documents, data) loads up front; each document's
// blocks load when the reader opens it.
const outDir = path.join(import.meta.dirname, "public", "data")
// Must match bodyFile() in app.ts.
const bodyFile = (id: string): string => id.replace(/[^\w-]/g, "_")
fs.rmSync(outDir, { recursive: true, force: true })
// --- Popularity: the analytics score, matched on the page URL ---

const popularity = new Map(
    (
        await q<{ slug: string; popularity: number }>(
            "SELECT slug, popularity FROM analytics_popularity"
        )
    ).map((r) => [r.slug, Number(r.popularity)])
)
for (const n of nodes.values()) {
    const pop =
        n.url && !n.url.includes("#") ? popularity.get(n.url) : undefined
    if (pop !== undefined) n.pop = Math.round(pop * 1000) / 1000
}

fs.mkdirSync(path.join(outDir, "docs"), { recursive: true })
const skeleton: Record<string, TreeNode> = {}
const bodies = new Map<string, Record<string, TreeNode>>()
for (const [id, n] of nodes) {
    if (!id.includes("#")) {
        skeleton[id] = n
        continue
    }
    const docId = id.split("#")[0]
    if (!bodies.has(docId)) bodies.set(docId, {})
    bodies.get(docId)![id] = n
}
// Every document gets a body file, even one with nothing readable in it.
// Must match DOC_KINDS in app.ts.
const DOC_KINDS = new Set([
    "article",
    "data-insight",
    "topic-page",
    "linear-topic-page",
    "chart",
    "view",
])
for (const n of nodes.values())
    if (DOC_KINDS.has(n.kind) && !bodies.has(n.id)) bodies.set(n.id, {})
for (const [docId, body] of bodies)
    fs.writeFileSync(
        path.join(outDir, "docs", `${bodyFile(docId)}.json`),
        JSON.stringify(body)
    )
// The text of every block, for full-text search: [id, text, 1 if heading].
// It loads on the first search, apart from the skeleton.
const text: [string, string, number][] = []
for (const body of bodies.values())
    for (const [id, n] of Object.entries(body)) {
        const join = (spans: Span[]): string =>
            spans.map((s) => (typeof s === "string" ? s : s.t)).join("")
        const words =
            n.kind === "heading"
                ? n.title
                : n.spans
                  ? join(n.spans)
                  : n.items?.map(join).join(" ")
        if (words?.trim()) text.push([id, words, n.kind === "heading" ? 1 : 0])
    }
fs.writeFileSync(path.join(outDir, "text.json"), JSON.stringify(text))
fs.writeFileSync(
    path.join(outDir, "site.json"),
    JSON.stringify({ nodes: skeleton, references })
)
const size = fs.statSync(path.join(outDir, "site.json")).size
console.log(
    `${nodes.size} nodes (${Object.keys(skeleton).length} in skeleton), ${bodies.size} document bodies, ${Object.keys(references).length} referenced targets, skeleton ${(size / 1e6).toFixed(1)} MB`
)
await db.end()
