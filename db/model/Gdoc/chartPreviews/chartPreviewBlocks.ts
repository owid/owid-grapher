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
 * before the component. Image and static viz components get the same treatment,
 * so authors see the uploaded image they refer to. This module finds those components and their images in
 * the raw Google Docs API document and builds the batchUpdate requests that
 * swap in fresh renders.
 */

export type ChartPreviewComponentType =
    | "chart"
    | "narrative-chart"
    | "image"
    | "static-viz"

export interface ChartPreviewComponentSpec {
    type: ChartPreviewComponentType
    /**
     * The chart URL for `chart`, the filename for `image`, the name for
     * `narrative-chart` and `static-viz`
     */
    target: string
}

export interface ChartPreviewBlock {
    tabId: string
    tabTitle: string
    /** Start index of the paragraph that opens the component, e.g. `{.chart}` */
    componentStartIndex: number
    spec: ChartPreviewComponentSpec
    image?: ChartPreviewImage
}

export interface ChartPreviewImage {
    objectId: string
    /** Position of the image in the tab */
    startIndex: number
    sourceUri?: string
    /** The image's size in the doc, in points */
    size?: { width: number; height: number }
}

interface ParsedParagraph {
    startIndex: number
    text: string
    /** The first link in the paragraph, if any */
    linkUrl?: string
    /** The image the paragraph ends with, if any */
    trailingImage?: { objectId: string; startIndex: number }
    hasImage: boolean
}

// The width of the text area on a US Letter page with 1-inch margins
const INSERTED_IMAGE_WIDTH_PT = 468

// A component spans a handful of `key: value` lines; don't look further than
// this for its closing `{}` in case it's malformed
const MAX_COMPONENT_LINES = 40

interface ComponentTarget {
    /** The property that says what the component shows */
    key: string
    isUrl: boolean
    /** Whether the parser also accepts `type: value` on a single line */
    hasSingleLineForm: boolean
}

const COMPONENT_TARGETS: Record<ChartPreviewComponentType, ComponentTarget> = {
    chart: { key: "url", isUrl: true, hasSingleLineForm: true },
    "narrative-chart": { key: "name", isUrl: false, hasSingleLineForm: true },
    image: { key: "filename", isUrl: false, hasSingleLineForm: false },
    "static-viz": { key: "name", isUrl: false, hasSingleLineForm: false },
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
    let trailingImage: ParsedParagraph["trailingImage"]
    let hasImage = false
    for (const el of elements) {
        if (el.textRun) {
            const content = el.textRun.content ?? ""
            text += content
            linkUrl ??= el.textRun.textStyle?.link?.url ?? undefined
            // Whitespace (incl. the paragraph's closing newline) after an
            // image doesn't stop it from being the trailing element
            if (content.trim()) trailingImage = undefined
        } else if (el.richLink?.richLinkProperties?.uri) {
            text += el.richLink.richLinkProperties.uri
            linkUrl ??= el.richLink.richLinkProperties.uri
            trailingImage = undefined
        } else if (
            el.inlineObjectElement?.inlineObjectId &&
            typeof el.startIndex === "number"
        ) {
            trailingImage = {
                objectId: el.inlineObjectElement.inlineObjectId,
                startIndex: el.startIndex,
            }
            hasImage = true
        }
    }
    return {
        startIndex,
        text,
        linkUrl,
        trailingImage,
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

    for (const [type, { key, isUrl, hasSingleLineForm }] of Object.entries(
        COMPONENT_TARGETS
    ) as [ChartPreviewComponentType, ComponentTarget][]) {
        // Single-line form, e.g. `chart: https://...`
        const inline = hasSingleLineForm
            ? text.match(new RegExp(`^${type}\\s*:\\s*(.+)$`))
            : null
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
function findPreviewImage(
    paragraphs: ParsedParagraph[],
    componentIndex: number
): ParsedParagraph["trailingImage"] {
    for (let i = componentIndex - 1; i >= 0; i--) {
        const paragraph = paragraphs[i]
        if (!paragraph.text.trim() && !paragraph.hasImage) continue
        return paragraph.trailingImage
    }
    return undefined
}

function toPoints(
    dimension: docs_v1.Schema$Dimension | undefined
): number | undefined {
    return dimension?.unit === "PT" && typeof dimension.magnitude === "number"
        ? dimension.magnitude
        : undefined
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
                const found = findPreviewImage(paragraphs, i)
                const embeddedObject = found
                    ? inlineObjects[found.objectId]?.inlineObjectProperties
                          ?.embeddedObject
                    : undefined
                const width = toPoints(embeddedObject?.size?.width)
                const height = toPoints(embeddedObject?.size?.height)
                blocks.push({
                    tabId,
                    tabTitle,
                    componentStartIndex: paragraphs[i].startIndex,
                    spec,
                    image: found
                        ? {
                              ...found,
                              sourceUri:
                                  embeddedObject?.imageProperties?.sourceUri ??
                                  undefined,
                              size:
                                  width && height
                                      ? { width, height }
                                      : undefined,
                          }
                        : undefined,
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
            // Keeps the size the image has in the doc, cropping if the new
            // image has a different shape. Our chart PNGs all have the same
            // aspect ratio; other images get reinserted instead.
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
 * Swaps the image for one with a different shape: the API can't resize an
 * image, so this deletes it and inserts the new one in its place at the same
 * width, letting Google derive the height
 */
export function makeReinsertImageRequests({
    block,
    imageUrl,
}: ChartPreviewChange): docs_v1.Schema$Request[] {
    if (!block.image) throw new Error("Block has no image to reinsert")
    const { startIndex, size } = block.image
    return [
        {
            deleteContentRange: {
                range: {
                    startIndex,
                    endIndex: startIndex + 1,
                    tabId: block.tabId,
                },
            },
        },
        {
            insertInlineImage: {
                location: { index: startIndex, tabId: block.tabId },
                uri: imageUrl,
                objectSize: {
                    width: {
                        magnitude: size?.width ?? INSERTED_IMAGE_WIDTH_PT,
                        unit: "PT",
                    },
                },
            },
        },
    ]
}

/**
 * Replacements address images by id, so their order doesn't matter. Inserts
 * and reinserts address positions, so they go last and from the end of each
 * tab backwards, so that earlier ones don't shift the positions of later ones.
 */
export function makeChartPreviewRequests(
    replacements: ChartPreviewChange[],
    insertions: ChartPreviewChange[],
    reinsertions: ChartPreviewChange[] = []
): docs_v1.Schema$Request[] {
    const positional = [
        ...insertions.map((change) => ({
            change,
            index: change.block.componentStartIndex,
            makeRequests: makeInsertImageRequests,
        })),
        ...reinsertions.map((change) => ({
            change,
            index: change.block.image!.startIndex,
            makeRequests: makeReinsertImageRequests,
        })),
    ].toSorted(
        (a, b) =>
            a.change.block.tabId.localeCompare(b.change.block.tabId) ||
            b.index - a.index
    )
    return [
        ...replacements.map(makeReplaceImageRequest),
        ...positional.flatMap(({ change, makeRequests }) =>
            makeRequests(change)
        ),
    ]
}
