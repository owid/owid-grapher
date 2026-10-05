import { type docs_v1 } from "@googleapis/docs"
import { type OwidRawGdocBlock } from "@ourworldindata/types"
import { acceptAllGdocSuggestions } from "../acceptAllGdocSuggestions.js"
import {
    extractUrl,
    paragraphElementsToArchieText,
} from "@ourworldindata/gdoc-pipeline"

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
 * before the component. Other components that show a chart or an uploaded
 * image get the same treatment. This module finds those components and their
 * images in the raw Google Docs API document and builds the batchUpdate
 * requests that swap in fresh renders.
 */

/** What a component's target property refers to, which decides how it renders */
export type ChartPreviewTargetKind =
    | "chartUrl"
    | "narrativeChartName"
    | "imageFilename"
    | "staticVizName"

export type ChartPreviewComponentType =
    | "chart"
    | "narrative-chart"
    | "key-indicator"
    | "image"
    | "static-viz"
    | "pull-chart"

export interface ChartPreviewComponentSpec {
    /** The ArchieML component type */
    type: ChartPreviewComponentType
    kind: ChartPreviewTargetKind
    /** The chart URL, narrative chart name, image filename or static viz name */
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
    /** Plain text, with smart chips as their URL */
    text: string
    /** The text as ingestion sees it, with links etc. as HTML */
    archieText: string
    /** The image the paragraph ends with, if any */
    trailingImage?: { objectId: string; startIndex: number }
    hasImage: boolean
}

// The width of the text area on a US Letter page with 1-inch margins
const INSERTED_IMAGE_WIDTH_PT = 468

// A component spans a handful of `key: value` lines; don't look further than
// this for its closing `{}` in case it's malformed
const MAX_COMPONENT_LINES = 40

type RawBlockOfType<T extends OwidRawGdocBlock["type"]> = Extract<
    OwidRawGdocBlock,
    { type: T }
>

interface ComponentTarget<T extends ChartPreviewComponentType> {
    /** The property that says what the component shows */
    key: Extract<keyof Exclude<RawBlockOfType<T>["value"], string>, string>
    kind: ChartPreviewTargetKind
    /**
     * Whether the component can be written on a single line as well, e.g.
     * `chart: <url>`. Only components whose raw value can be a string can.
     */
    hasSingleLineForm: string extends RawBlockOfType<T>["value"]
        ? boolean
        : false
}

/**
 * The components that get a preview image. Typed against the raw ArchieML
 * blocks, so the property names stay in sync with what ingestion parses.
 * Chart stories need no entry: their `chart: <url>` lines are read as the
 * single-line form of `chart`.
 */
const COMPONENT_TARGETS: {
    [T in ChartPreviewComponentType]: ComponentTarget<T>
} = {
    chart: { key: "url", kind: "chartUrl", hasSingleLineForm: true },
    "narrative-chart": {
        key: "name",
        kind: "narrativeChartName",
        hasSingleLineForm: true,
    },
    "key-indicator": {
        key: "datapageUrl",
        kind: "chartUrl",
        hasSingleLineForm: false,
    },
    image: { key: "filename", kind: "imageFilename", hasSingleLineForm: false },
    "static-viz": {
        key: "name",
        kind: "staticVizName",
        hasSingleLineForm: false,
    },
    // Pull charts show an uploaded thumbnail, not a render of their url
    "pull-chart": {
        key: "image",
        kind: "imageFilename",
        hasSingleLineForm: false,
    },
}

function parseParagraph(
    element: docs_v1.Schema$StructuralElement
): ParsedParagraph | undefined {
    const paragraph = element.paragraph
    const startIndex = element.startIndex
    if (!paragraph || typeof startIndex !== "number") return undefined
    const elements = paragraph.elements ?? []
    let text = ""
    let trailingImage: ParsedParagraph["trailingImage"]
    let hasImage = false
    for (const el of elements) {
        if (el.textRun) {
            const content = el.textRun.content ?? ""
            text += content
            // Whitespace (incl. the paragraph's closing newline) after an
            // image doesn't stop it from being the trailing element
            if (content.trim()) trailingImage = undefined
        } else if (el.richLink?.richLinkProperties?.uri) {
            text += el.richLink.richLinkProperties.uri
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
        archieText: paragraphElementsToArchieText(elements),
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
 * Reads `key: value` from a paragraph. URLs are read from the paragraph's
 * ArchieML text with extractUrl, like ingestion does, so linked text and smart
 * chips resolve to their link target.
 */
function readValue(
    paragraph: ParsedParagraph,
    key: string,
    kind: ChartPreviewTargetKind
): string | undefined {
    const regex = new RegExp(`^${key}\\s*:\\s*(.*)$`, "s")
    const value = paragraph.text.trim().match(regex)?.[1].trim()
    if (value === undefined || kind !== "chartUrl") return value
    const archieValue = paragraph.archieText.trim().match(regex)?.[1]
    return extractUrl(archieValue ?? value)
}

function matchComponent(
    paragraphs: ParsedParagraph[],
    index: number
): ChartPreviewComponentSpec | undefined {
    const paragraph = paragraphs[index]
    const text = paragraph.text.trim()

    for (const [type, { key, kind, hasSingleLineForm }] of Object.entries(
        COMPONENT_TARGETS
    ) as [
        ChartPreviewComponentType,
        ComponentTarget<ChartPreviewComponentType>,
    ][]) {
        // Single-line form, e.g. `chart: https://...`
        const inline = hasSingleLineForm
            ? readValue(paragraph, type, kind)
            : undefined
        if (inline) return { type, kind, target: inline }

        // Object form, e.g. `{.chart}` followed by `url: https://...` and `{}`
        if (!new RegExp(`^\\{\\s*\\.${type}\\s*\\}$`).test(text)) continue
        const lastIndex = Math.min(
            paragraphs.length,
            index + 1 + MAX_COMPONENT_LINES
        )
        for (let i = index + 1; i < lastIndex; i++) {
            if (/^\{\s*\}$/.test(paragraphs[i].text.trim())) return undefined
            const target = readValue(paragraphs[i], key, kind)
            if (target !== undefined)
                return target ? { type, kind, target } : undefined
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
 *
 * The doc is fetched with suggestions inline, since that's the view our write
 * indices address. It's read as if all suggestions were accepted, the same way
 * ingestion accepts them, so a suggested change to a component's url previews
 * the new url. Accepting suggestions keeps the elements' indices as they are.
 */
export function findChartPreviewBlocks(
    document: docs_v1.Schema$Document
): ChartPreviewBlock[] {
    const blocks: ChartPreviewBlock[] = []
    const accepted = acceptAllGdocSuggestions(document)
    for (const tab of flattenTabs(accepted.tabs ?? [])) {
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
