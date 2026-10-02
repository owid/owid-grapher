import { type docs_v1 } from "@googleapis/docs"

/**
 * Chart components in a gdoc have no visual representation while authors are
 * writing, so by convention a PNG of the chart sits right above the component:
 *
 *     [image]
 *     {.chart}
 *     url: https://ourworldindata.org/grapher/life-expectancy
 *     {}
 *
 * The image is either in a paragraph of its own or at the end of the paragraph
 * before the component. This module finds those components and their images in
 * the raw Google Docs API document and builds the batchUpdate requests that
 * swap in fresh renders.
 */

export type ChartPreviewComponentType = "chart" | "narrative-chart"

export interface ChartPreviewComponentSpec {
    type: ChartPreviewComponentType
    /** The chart URL for `chart`, the name for `narrative-chart` */
    target: string
}

export interface ChartPreviewBlock {
    tabId: string
    tabTitle: string
    /** Start index of the paragraph that opens the component, e.g. `{.chart}` */
    componentStartIndex: number
    spec: ChartPreviewComponentSpec
    image?: { objectId: string; sourceUri?: string }
}

interface ParsedParagraph {
    startIndex: number
    text: string
    /** The first link in the paragraph, if any */
    linkUrl?: string
    /** The image the paragraph ends with, if any */
    trailingImageObjectId?: string
    hasImage: boolean
}

// The width of the text area on a US Letter page with 1-inch margins
const INSERTED_IMAGE_WIDTH_PT = 468

// A component spans a handful of `key: value` lines; don't look further than
// this for its closing `{}` in case it's malformed
const MAX_COMPONENT_LINES = 40

/** The property of each component that says what it shows */
const COMPONENT_TARGETS: Record<
    ChartPreviewComponentType,
    { key: string; isUrl: boolean }
> = {
    chart: { key: "url", isUrl: true },
    "narrative-chart": { key: "name", isUrl: false },
}

function parseParagraph(
    element: docs_v1.Schema$StructuralElement
): ParsedParagraph | undefined {
    const paragraph = element.paragraph
    const startIndex = element.startIndex
    if (!paragraph || typeof startIndex !== "number") return undefined
    const elements = paragraph.elements ?? []
    let text = ""
    let linkUrl: string | undefined
    let trailingImageObjectId: string | undefined
    let hasImage = false
    for (const el of elements) {
        if (el.textRun) {
            const content = el.textRun.content ?? ""
            text += content
            linkUrl ??= el.textRun.textStyle?.link?.url ?? undefined
            // Whitespace (incl. the paragraph's closing newline) after an
            // image doesn't stop it from being the trailing element
            if (content.trim()) trailingImageObjectId = undefined
        } else if (el.richLink?.richLinkProperties?.uri) {
            text += el.richLink.richLinkProperties.uri
            linkUrl ??= el.richLink.richLinkProperties.uri
            trailingImageObjectId = undefined
        } else if (el.inlineObjectElement?.inlineObjectId) {
            trailingImageObjectId = el.inlineObjectElement.inlineObjectId
            hasImage = true
        }
    }
    return {
        startIndex,
        text,
        linkUrl,
        trailingImageObjectId,
        hasImage,
    }
}

/** Groups paragraphs by the container they're in: the body or a table cell */
function collectParagraphGroups(
    content: docs_v1.Schema$StructuralElement[]
): ParsedParagraph[][] {
    const groups: ParsedParagraph[][] = []
    const current: ParsedParagraph[] = []
    for (const element of content) {
        const paragraph = parseParagraph(element)
        if (paragraph) current.push(paragraph)
        for (const row of element.table?.tableRows ?? []) {
            for (const cell of row.tableCells ?? []) {
                groups.push(...collectParagraphGroups(cell.content ?? []))
            }
        }
    }
    groups.push(current)
    return groups
}

/**
 * For URLs, mirrors extractUrl: plain text URLs win, otherwise use the link
 * target
 */
function readTarget(
    value: string,
    paragraph: ParsedParagraph,
    isUrl: boolean
): string {
    if (!isUrl || value.startsWith("http") || !paragraph.linkUrl) return value
    return paragraph.linkUrl
}

function matchComponent(
    paragraphs: ParsedParagraph[],
    index: number
): ChartPreviewComponentSpec | undefined {
    const paragraph = paragraphs[index]
    const text = paragraph.text.trim()

    for (const [type, { key, isUrl }] of Object.entries(COMPONENT_TARGETS) as [
        ChartPreviewComponentType,
        { key: string; isUrl: boolean },
    ][]) {
        // Single-line form, e.g. `chart: https://...`
        const inline = text.match(new RegExp(`^${type}\\s*:\\s*(.+)$`))
        if (inline) {
            return {
                type,
                target: readTarget(inline[1].trim(), paragraph, isUrl),
            }
        }

        // Object form, e.g. `{.chart}` followed by `url: https://...` and `{}`
        if (!new RegExp(`^\\{\\s*\\.${type}\\s*\\}$`).test(text)) continue
        const keyRegex = new RegExp(`^${key}\\s*:\\s*(.*)$`)
        const lastIndex = Math.min(
            paragraphs.length,
            index + 1 + MAX_COMPONENT_LINES
        )
        for (let i = index + 1; i < lastIndex; i++) {
            const line = paragraphs[i].text.trim()
            if (/^\{\s*\}$/.test(line)) return undefined
            const match = line.match(keyRegex)
            if (match) {
                const target = readTarget(match[1].trim(), paragraphs[i], isUrl)
                return target ? { type, target } : undefined
            }
        }
        return undefined
    }
    return undefined
}

/** The image right above the component, skipping blank lines */
function findPreviewImageObjectId(
    paragraphs: ParsedParagraph[],
    componentIndex: number
): string | undefined {
    for (let i = componentIndex - 1; i >= 0; i--) {
        const paragraph = paragraphs[i]
        if (!paragraph.text.trim() && !paragraph.hasImage) continue
        return paragraph.trailingImageObjectId
    }
    return undefined
}

function flattenTabs(tabs: docs_v1.Schema$Tab[]): docs_v1.Schema$Tab[] {
    return tabs.flatMap((tab) => [tab, ...flattenTabs(tab.childTabs ?? [])])
}

/**
 * Finds all chart components in all tabs of a document fetched with
 * `includeTabsContent: true`.
 */
export function findChartPreviewBlocks(
    document: docs_v1.Schema$Document
): ChartPreviewBlock[] {
    const blocks: ChartPreviewBlock[] = []
    for (const tab of flattenTabs(document.tabs ?? [])) {
        const tabId = tab.tabProperties?.tabId
        const documentTab = tab.documentTab
        if (!tabId || !documentTab) continue
        const tabTitle = tab.tabProperties?.title ?? ""
        const inlineObjects = documentTab.inlineObjects ?? {}
        const groups = collectParagraphGroups(documentTab.body?.content ?? [])
        for (const paragraphs of groups) {
            for (let i = 0; i < paragraphs.length; i++) {
                const spec = matchComponent(paragraphs, i)
                if (!spec) continue
                const objectId = findPreviewImageObjectId(paragraphs, i)
                const sourceUri = objectId
                    ? (inlineObjects[objectId]?.inlineObjectProperties
                          ?.embeddedObject?.imageProperties?.sourceUri ??
                      undefined)
                    : undefined
                blocks.push({
                    tabId,
                    tabTitle,
                    componentStartIndex: paragraphs[i].startIndex,
                    spec,
                    image: objectId ? { objectId, sourceUri } : undefined,
                })
            }
        }
    }
    return blocks
}

export interface ChartPreviewChange {
    block: ChartPreviewBlock
    imageUrl: string
}

export function makeReplaceImageRequest({
    block,
    imageUrl,
}: ChartPreviewChange): docs_v1.Schema$Request {
    if (!block.image) throw new Error("Block has no image to replace")
    return {
        replaceImage: {
            imageObjectId: block.image.objectId,
            tabId: block.tabId,
            uri: imageUrl,
            // Keeps the size the image has in the doc. Our PNGs all have the
            // same aspect ratio, so nothing gets cropped in practice.
            imageReplaceMethod: "CENTER_CROP",
        },
    }
}

/** Puts the image in a new paragraph right above the component */
export function makeInsertImageRequests({
    block,
    imageUrl,
}: ChartPreviewChange): docs_v1.Schema$Request[] {
    const location = { index: block.componentStartIndex, tabId: block.tabId }
    return [
        { insertText: { location, text: "\n" } },
        {
            insertInlineImage: {
                location,
                uri: imageUrl,
                objectSize: {
                    width: { magnitude: INSERTED_IMAGE_WIDTH_PT, unit: "PT" },
                },
            },
        },
    ]
}

/**
 * Replacements address images by id, so their order doesn't matter. Inserts
 * address positions, so they go last and from the end of each tab backwards,
 * so that earlier inserts don't shift the positions of later ones.
 */
export function makeChartPreviewRequests(
    replacements: ChartPreviewChange[],
    insertions: ChartPreviewChange[]
): docs_v1.Schema$Request[] {
    const sortedInsertions = insertions.toSorted(
        (a, b) =>
            a.block.tabId.localeCompare(b.block.tabId) ||
            b.block.componentStartIndex - a.block.componentStartIndex
    )
    return [
        ...replacements.map(makeReplaceImageRequest),
        ...sortedInsertions.flatMap(makeInsertImageRequests),
    ]
}
