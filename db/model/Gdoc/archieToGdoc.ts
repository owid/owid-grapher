import {
    OwidGdocPostContent,
    traverseEnrichedBlock,
} from "@ourworldindata/utils"
import {
    OwidGdocType,
    type EnrichedBlockText,
    type OwidGdocAnnouncementContent,
    type OwidGdocDataInsightContent,
    type OwidEnrichedGdocBlock,
    type Span,
} from "@ourworldindata/types"
import {
    propertyToArchieMLString,
    OwidRawGdocBlockToArchieMLStringGenerator,
} from "./rawToArchie.js"
import { GDOCS_BACKPORTING_TARGET_FOLDER } from "../../../settings/serverSettings.js"
import { enrichedBlockToRawBlock } from "./enrichedToRaw.js"
import { type docs_v1, docs as googleDocs } from "@googleapis/docs"
import { type drive_v3, drive as googleDrive } from "@googleapis/drive"
import { OwidGoogleAuth } from "../../OwidGoogleAuth.js"
import * as cheerio from "cheerio"
import type { AnyNode } from "domhandler"

// Collect the set of ref IDs that appear as ID-based refs in the body.
// These are the entries that need to live in the [.refs] frontmatter
// block. Inline refs are NOT collected — their content is emitted inline
// as `{ref}content{/ref}` by spanToArchieMLSourceString, with no
// frontmatter definition required.
function collectIdBasedRefIds(
    body: OwidEnrichedGdocBlock[] | undefined
): Set<string> {
    const ids = new Set<string>()
    if (!body) return ids
    const visitSpan = (span: Span): void => {
        if (span.spanType === "span-ref" && span.sourceForm.kind === "id") {
            ids.add(span.sourceForm.id)
        }
    }
    const noop = (_b: OwidEnrichedGdocBlock): void => undefined
    for (const block of body) {
        traverseEnrichedBlock(block, noop, visitSpan)
    }
    return ids
}

// Emit the authors line in its authoring form, reconstructing the
// "Name (Role)" annotations that parseAuthors extracted into authorRoles —
// otherwise roles authored in the document are lost on write-back.
function* yieldAuthorsWithRoles(content: {
    authors?: string[]
    authorRoles?: Record<string, string>
}): Generator<string, void, undefined> {
    if (!content.authors?.length) return
    const authors = content.authors.map((name) => {
        const role = content.authorRoles?.[name]
        return role ? `${name} (${role})` : name
    })
    yield `authors: ${authors.join(", ")}`
}

// Emit a [+key] freeform frontmatter block for a text-blocks field
// (deprecation-notice, latest-feed-excerpt), mirroring the body emission.
function* yieldTextBlocksIfDefined(
    key: string,
    blocks: EnrichedBlockText[] | undefined
): Generator<string, void, undefined> {
    if (!blocks?.length) return
    yield `[+${key}]`
    for (const block of blocks) {
        const rawBlock = enrichedBlockToRawBlock(block)
        yield* OwidRawGdocBlockToArchieMLStringGenerator(rawBlock)
        yield ""
    }
    yield "[]"
}

// Emit a [.refs] frontmatter block listing each ID-based ref's id +
// content. Order follows the order in which ID-based refs first appear
// in the body, which is deterministic and matches what extractRefs sees
// on the way back in. Skipped entirely when there are no ID-based refs.
function* yieldRefsBlockIfDefined(
    article: OwidGdocPostContent
): Generator<string, void, undefined> {
    const definitions = article.refs?.definitions
    if (!definitions) return
    const idBased = collectIdBasedRefIds(article.body)
    if (idBased.size === 0) return
    yield "[.refs]"
    for (const id of idBased) {
        const ref = definitions[id]
        if (!ref) continue
        yield `id: ${id}`
        yield "[.+content]"
        for (const block of ref.content) {
            const rawBlock = enrichedBlockToRawBlock(block)
            yield* OwidRawGdocBlockToArchieMLStringGenerator(rawBlock)
        }
        yield "[]"
    }
    yield "[]"
}

/** Content shapes the ArchieML write-back layer knows how to serialize. */
export type ArchieMlWritableContent =
    | OwidGdocPostContent
    | OwidGdocDataInsightContent
    | OwidGdocAnnouncementContent

export function* owidArticleToArchieMLStringGenerator(
    article: ArchieMlWritableContent
): Generator<string, void, undefined> {
    if (article.type === OwidGdocType.DataInsight) {
        const dataInsight: OwidGdocDataInsightContent = article
        yield* propertyToArchieMLString("title", dataInsight)
        yield* yieldAuthorsWithRoles(dataInsight)
        yield* propertyToArchieMLString("type", dataInsight)
        yield* propertyToArchieMLString("grapher-url", dataInsight)
        yield* propertyToArchieMLString("narrative-chart", dataInsight)
        yield* propertyToArchieMLString("figma-url", dataInsight)
    } else if (article.type === OwidGdocType.Announcement) {
        // The nested `cta` front-matter property is deliberately not emitted
        // here — it is classified "unsupported" in
        // OWID_GDOC_ANNOUNCEMENT_CONTENT_KEYS, so the write gate refuses
        // documents that author it instead of losing it silently.
        const announcement: OwidGdocAnnouncementContent = article
        yield* propertyToArchieMLString("title", announcement)
        yield* yieldAuthorsWithRoles(announcement)
        yield* propertyToArchieMLString("type", announcement)
        yield* propertyToArchieMLString("kicker", announcement)
        yield* propertyToArchieMLString("excerpt", announcement)
        yield* propertyToArchieMLString("featured-image", announcement)
    } else {
        const post = article
        yield* propertyToArchieMLString("title", post)
        yield* propertyToArchieMLString("subtitle", post)
        yield* propertyToArchieMLString("supertitle", post)
        yield* yieldAuthorsWithRoles(post)
        yield* propertyToArchieMLString("dateline", post)
        yield* propertyToArchieMLString("excerpt", post)
        yield* propertyToArchieMLString("type", post)
        if (post["sticky-nav"]) {
            yield "[.sticky-nav]"
            for (const item of post["sticky-nav"]) {
                yield* propertyToArchieMLString("target", item)
                yield* propertyToArchieMLString("text", item)
            }
            yield "[]"
        }
        yield* propertyToArchieMLString("sidebar-toc", post)
        yield* propertyToArchieMLString("heading-variant", post)
        yield* propertyToArchieMLString("hide-subscribe-banner", post)
        yield* propertyToArchieMLString("hide-citation", post)
        yield* propertyToArchieMLString("cover-image", post)
        yield* propertyToArchieMLString("cover-color", post)
        yield* propertyToArchieMLString("featured-image", post)
        yield* propertyToArchieMLString("atom-title", post)
        yield* propertyToArchieMLString("atom-excerpt", post)
        yield* propertyToArchieMLString("latest-feed-featured-image", post)
        yield* yieldTextBlocksIfDefined(
            "deprecation-notice",
            post["deprecation-notice"]
        )
        yield* yieldTextBlocksIfDefined(
            "latest-feed-excerpt",
            post["latest-feed-excerpt"]
        )
        yield* yieldRefsBlockIfDefined(post)
    }
    yield ""
    if (article.body) {
        yield "[+body]"
        for (const block of article.body) {
            const rawBlock = enrichedBlockToRawBlock(block)
            const lines = [
                ...OwidRawGdocBlockToArchieMLStringGenerator(rawBlock),
            ]
            yield* lines
            yield ""
        }
        yield "[]"
    }
}

interface TextFragment {
    text: string
    style: docs_v1.Schema$TextStyle
}

interface Line {
    fragments: TextFragment[]
}

const defaultStyle: docs_v1.Schema$TextStyle = {
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    baselineOffset: "NONE",
    link: undefined,
}
function mergeStyleStack(
    styleStack: docs_v1.Schema$TextStyle[]
): docs_v1.Schema$TextStyle {
    const mergedStyle = styleStack.reduce(
        (acc, style) => ({
            ...acc,
            ...style,
        }),
        defaultStyle
    )
    return mergedStyle
}

function* convertCheerioNodesToTextFragments(
    nodes: Iterable<AnyNode>,
    parentStyleStack: docs_v1.Schema$TextStyle[]
): Generator<TextFragment, void, undefined> {
    for (const node of nodes) {
        if (node.type === "text") {
            const currentStyle = mergeStyleStack(parentStyleStack)
            const text = node.data
            if (text && text !== "") yield { text, style: currentStyle }
        } else if (node.type === "tag") {
            const tag = node.name
            const styleStack = [...parentStyleStack]
            if (tag === "b") {
                styleStack.push({ bold: true })
            } else if (tag === "i") {
                styleStack.push({ italic: true })
            } else if (tag === "q") {
                styleStack.push({ italic: true })
            } else if (tag === "u") {
                styleStack.push({ underline: true })
            } else if (tag === "s") {
                styleStack.push({ strikethrough: true })
            } else if (tag === "sup") {
                styleStack.push({ baselineOffset: "SUPERSCRIPT" })
            } else if (tag === "sub") {
                styleStack.push({ baselineOffset: "SUBSCRIPT" })
            } else if (tag === "a") {
                // TODO: ref links have a class assigned and will need to be handled here
                styleStack.push({ link: { url: node.attribs.href } })
            } else if (tag === "br") {
                yield { text: "\n", style: defaultStyle }
            }
            yield* convertCheerioNodesToTextFragments(node.children, styleStack)
        }
    }
}

function* lineToBatchUpdates(line: Line): Generator<docs_v1.Schema$Request> {
    yield {
        insertText: {
            location: {
                index: 1,
            },
            text: "\n",
        },
    }
    for (const fragment of line.fragments) {
        // Fragments will be reversed after they are generated - this is why we first
        // emit the style change and then the text.
        yield {
            updateTextStyle: {
                range: {
                    startIndex: 1,
                    endIndex: fragment.text.length + 1,
                },
                textStyle: fragment.style,
                fields: "bold,italic,underline,strikethrough,baselineOffset,link",
            },
        }
        yield {
            insertText: {
                location: {
                    index: 1,
                },
                text: fragment.text,
            },
        }
    }
}

// --- ArchieML syntax decoration ---------------------------------------
// Mirrors the formatting conventions of the OWID gdocs add-on
// (https://github.com/owid/gdocs-addon, dist/server/format.ts) so a doc
// written through the API looks the same as one formatted by the add-on:
// nesting indentation, blue property keys, depth-cycled delimiter colors,
// small gray Courier refs. Everything is style-only (colors, fonts,
// paragraph indents) — gdocToArchie ignores all of these, so the styling
// is invisible to the ingestion round-trip.

const DELIMITER_COLORS = ["#f47835", "#23974a", "#ff00ff"]
const PROPERTY_KEY_COLOR = "#0094ff"
const REF_COLOR = "#535353"
const INDENT_PT_PER_LEVEL = 10

function hexToDocsColor(hex: string): docs_v1.Schema$OptionalColor {
    const [red, green, blue] = [1, 3, 5].map(
        (i) => parseInt(hex.slice(i, i + 2), 16) / 255
    )
    return { color: { rgbColor: { red, green, blue } } }
}

function foregroundColorStyle(
    hex: string
): Pick<ArchieMlTextStyleRange, "textStyle" | "fields"> {
    return {
        textStyle: { foregroundColor: hexToDocsColor(hex) },
        fields: "foregroundColor",
    }
}

const refStyle: Pick<ArchieMlTextStyleRange, "textStyle" | "fields"> = {
    textStyle: {
        foregroundColor: hexToDocsColor(REF_COLOR),
        fontSize: { magnitude: 8, unit: "PT" },
        weightedFontFamily: { fontFamily: "Courier New" },
    },
    fields: "foregroundColor,fontSize,weightedFontFamily",
}

export interface ArchieMlTextStyleRange {
    /** Character offset within the line (inclusive) */
    start: number
    /** Character offset within the line (exclusive) */
    end: number
    textStyle: docs_v1.Schema$TextStyle
    fields: string
}

export interface ArchieMlLineDecoration {
    indentLevel: number
    styleRanges: ArchieMlTextStyleRange[]
}

// Computes, per line of ArchieML text, the nesting indent level and the
// character ranges to style. Verbatim regions (html:…:end blocks and
// :skip/:ignore segments) get no styling and keep the running indent —
// their content must not be interpreted as ArchieML syntax.
export function decorateArchieMlLines(
    lines: string[]
): ArchieMlLineDecoration[] {
    let level = 0
    let isInsideHtmlBlock = false
    let isInsideSkipBlock = false
    let isAfterIgnore = false
    return lines.map((line): ArchieMlLineDecoration => {
        if (line.startsWith("html:")) isInsideHtmlBlock = true
        else if (line === ":end") isInsideHtmlBlock = false
        if (line === ":skip") isInsideSkipBlock = true
        else if (line === ":ignore") isAfterIgnore = true
        if (isInsideHtmlBlock || isInsideSkipBlock || isAfterIgnore) {
            if (line === ":endskip") isInsideSkipBlock = false
            return { indentLevel: level, styleRanges: [] }
        }

        const isObjectOpening = /^\{[a-zA-Z0-9+._-]+\}$/.test(line)
        const isArrayOpening = /^\[[a-zA-Z0-9+._-]+\]$/.test(line)
        if (isObjectOpening || isArrayOpening) {
            const decoration = {
                indentLevel: level,
                styleRanges: [
                    {
                        start: 0,
                        end: line.length,
                        ...foregroundColorStyle(
                            DELIMITER_COLORS[level % DELIMITER_COLORS.length]
                        ),
                    },
                ],
            }
            level++
            return decoration
        }
        if (line === "{}" || line === "[]") {
            level = Math.max(0, level - 1)
            return {
                indentLevel: level,
                styleRanges: [
                    {
                        start: 0,
                        end: line.length,
                        ...foregroundColorStyle(
                            DELIMITER_COLORS[level % DELIMITER_COLORS.length]
                        ),
                    },
                ],
            }
        }

        const styleRanges: ArchieMlTextStyleRange[] = []
        const property = line.match(/^([a-zA-Z0-9_.-]+):/)
        if (property) {
            styleRanges.push({
                start: 0,
                end: property[1].length + 1,
                ...foregroundColorStyle(PROPERTY_KEY_COLOR),
            })
        }
        for (const match of line.matchAll(/\{ref\}.*?\{\/ref\}/g)) {
            styleRanges.push({
                start: match.index,
                end: match.index + match[0].length,
                ...refStyle,
            })
        }
        return { indentLevel: level, styleRanges }
    })
}

// Builds the style requests that decorate the freshly inserted ArchieML
// text. These run after all inserts, when the document body is exactly
// "\n" + line₁ + "\n" + line₂ + … — so line i starts at absolute index
// 2 + Σⱼ<ᵢ(lenⱼ + 1). Starts with whole-range resets so nothing is
// inherited from the wiped document's residual paragraph.
function archieMlDecorationRequests(
    renderedLines: string[]
): docs_v1.Schema$Request[] {
    const decorations = decorateArchieMlLines(renderedLines)

    const lineStarts: number[] = []
    let cursor = 2
    for (const line of renderedLines) {
        lineStarts.push(cursor)
        cursor += line.length + 1
    }
    const contentEnd = cursor - 1
    if (contentEnd <= 1) return []

    const indentPt = (level: number): docs_v1.Schema$Dimension => ({
        magnitude: level * INDENT_PT_PER_LEVEL,
        unit: "PT",
    })

    const requests: docs_v1.Schema$Request[] = [
        {
            updateTextStyle: {
                range: { startIndex: 1, endIndex: contentEnd },
                textStyle: {},
                fields: "foregroundColor,fontSize,weightedFontFamily",
            },
        },
        {
            updateParagraphStyle: {
                range: { startIndex: 1, endIndex: contentEnd },
                paragraphStyle: {
                    indentStart: indentPt(0),
                    indentFirstLine: indentPt(0),
                },
                fields: "indentStart,indentFirstLine",
            },
        },
    ]

    // Indent runs of consecutive lines at the same level with one request.
    // A line's paragraph spans its text plus the following "\n" (which sits
    // just before the next line), so the run range must start at the first
    // line's own start — one index earlier would touch the previous
    // paragraph.
    let i = 0
    while (i < renderedLines.length) {
        const level = decorations[i].indentLevel
        if (level === 0) {
            i++
            continue
        }
        let j = i
        while (
            j + 1 < renderedLines.length &&
            decorations[j + 1].indentLevel === level
        ) {
            j++
        }
        const startIndex = lineStarts[i]
        const endIndex = Math.min(
            lineStarts[j] + renderedLines[j].length + 1,
            contentEnd
        )
        if (endIndex > startIndex) {
            requests.push({
                updateParagraphStyle: {
                    range: { startIndex, endIndex },
                    paragraphStyle: {
                        indentStart: indentPt(level),
                        indentFirstLine: indentPt(level),
                    },
                    fields: "indentStart,indentFirstLine",
                },
            })
        }
        i = j + 1
    }

    decorations.forEach((decoration, lineIndex) => {
        for (const range of decoration.styleRanges) {
            if (range.end <= range.start) continue
            requests.push({
                updateTextStyle: {
                    range: {
                        startIndex: lineStarts[lineIndex] + range.start,
                        endIndex: lineStarts[lineIndex] + range.end,
                    },
                    textStyle: range.textStyle,
                    fields: range.fields,
                },
            })
        }
    })

    return requests
}

export function articleToBatchUpdates(
    content: ArchieMlWritableContent
): docs_v1.Schema$Request[] {
    return archieMlTextToBatchUpdates(
        [...owidArticleToArchieMLStringGenerator(content)].join("\n")
    )
}

// Converts ArchieML text into Google Docs batchUpdate requests with real
// formatting (the inline HTML becomes styled text runs). Exposed separately
// from articleToBatchUpdates so callers can write text that carries verbatim
// segments (e.g. preserved :skip blocks) around the canonical form.
export function archieMlTextToBatchUpdates(
    text: string
): docs_v1.Schema$Request[] {
    const archieMlLines = text.split("\n")

    let isInsideHtmlBlock = false

    const lines: Line[] = archieMlLines.map((line) => {
        const styleStack: docs_v1.Schema$TextStyle[] = []
        // By convention our backported html blocks always end with
        // and :end specifier (the archieml construct to allow properties
        // to be multiline). This makes it easier to find the beginning and
        // end of html blocks here which we should *not* parse with cheerio
        // since this is meant to be literal html that we want to output as-is.
        if (line.startsWith("html:")) isInsideHtmlBlock = true
        else if (line === ":end") isInsideHtmlBlock = false

        let fragments: TextFragment[]
        if (!isInsideHtmlBlock) {
            const $ = cheerio.load(line, null, false)
            fragments = [
                ...convertCheerioNodesToTextFragments(
                    $.root().contents(),
                    styleStack
                ),
            ]
        } else fragments = [{ text: line, style: mergeStyleStack(styleStack) }]
        return { fragments }
    })

    const batchUpdates: docs_v1.Schema$Request[] = lines.flatMap((l) => [
        ...lineToBatchUpdates(l),
    ])

    // The decoration requests use absolute offsets into the final text, so
    // they are computed from the rendered lines (the fragment text, i.e.
    // with the inline HTML tags stripped) and appended after the reversed
    // inserts below — they run once the document is exactly that text.
    const renderedLines = lines.map((l) =>
        l.fragments.map((f) => f.text).join("")
    )

    // The batch updates are in their logical order here. To work in one batch update
    // we want to insert gdoc DOM spans in reverse order, so we reverse the batches here.
    // The code above already works under the assumption that the batches will be reversed.
    return [
        ...batchUpdates.toReversed(),
        ...archieMlDecorationRequests(renderedLines),
    ]
}

export async function deleteGdocContent(
    client: docs_v1.Docs,
    existingGdocId: string
): Promise<void> {
    // Retrieve raw data from Google
    const { data } = await client.documents.get({
        documentId: existingGdocId,
        suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
    })
    const content = data.body?.content
    if (content) {
        const endIndex = content[content.length - 1].endIndex!
        const deleteUpdate = [
            {
                deleteContentRange: {
                    range: {
                        startIndex: 1,
                        endIndex: endIndex - 1,
                    },
                },
            },
        ]
        await client.documents.batchUpdate({
            // The ID of the document to update.
            documentId: existingGdocId,

            // Request body metadata
            requestBody: {
                requests: deleteUpdate,
            },
        })
    }
}

async function createGdoc(
    driveClient: drive_v3.Drive,
    title: string | undefined,
    targetFolder: string
): Promise<string> {
    const docsMimeType = "application/vnd.google-apps.document"
    const createResp = await driveClient.files.create({
        supportsAllDrives: true,
        requestBody: {
            parents: [targetFolder],
            mimeType: docsMimeType,
            name: title,
        },
        media: {
            mimeType: docsMimeType,
            body: "",
        },
    })
    return createResp.data.id!
}

export async function createGdocAndInsertOwidGdocPostContent(
    content: ArchieMlWritableContent,
    existingGdocId: string | null,
    targetFolder: string = GDOCS_BACKPORTING_TARGET_FOLDER
): Promise<string> {
    const batchUpdates = articleToBatchUpdates(content)

    if (!existingGdocId && !targetFolder)
        throw new Error(
            "No target Drive folder given for gdoc creation (GDOCS_BACKPORTING_TARGET_FOLDER is not set)"
        )
    const auth = OwidGoogleAuth.getGoogleReadWriteAuth()
    const client = googleDocs({
        version: "v1",
        auth,
    })
    const driveClient = googleDrive({
        version: "v3",
        auth,
    })
    let documentId = existingGdocId

    if (existingGdocId) {
        await deleteGdocContent(client, existingGdocId)
    } else {
        documentId = await createGdoc(driveClient, content.title, targetFolder)
    }

    // Now that we have either created a new document or deleted the content of an existing one,
    // we can insert the new content.
    await client.documents.batchUpdate({
        documentId: documentId ?? undefined,
        requestBody: {
            requests: batchUpdates,
        },
    })

    return documentId!
}

export async function createGdocFromTemplate(
    templateId: string,
    title: string,
    targetFolder: string
): Promise<string> {
    const auth = OwidGoogleAuth.getGoogleReadWriteAuth()
    const driveClient = googleDrive({ version: "v3", auth })

    const docsMimeType = "application/vnd.google-apps.document"
    const response = await driveClient.files.copy({
        supportsAllDrives: true,
        fileId: templateId,
        requestBody: {
            name: title,
            parents: [targetFolder],
            mimeType: docsMimeType,
        },
    })

    if (!response.data.id) {
        throw new Error("Failed to copy document with ID " + templateId)
    }

    return response.data.id
}

export async function replacePlaceholdersInGdoc(
    docId: string,
    replacements: Record<string, string>
): Promise<void> {
    const auth = OwidGoogleAuth.getGoogleReadWriteAuth()
    const client = googleDocs({ version: "v1", auth })

    const requests = Object.entries(replacements).map(
        ([placeholder, value]) => ({
            replaceAllText: {
                containsText: {
                    text: `{{${placeholder}}}`, // Match placeholders like {{name}}
                    matchCase: true,
                },
                replaceText: value,
            },
        })
    )

    await client.documents.batchUpdate({
        documentId: docId,
        requestBody: { requests },
    })
}
