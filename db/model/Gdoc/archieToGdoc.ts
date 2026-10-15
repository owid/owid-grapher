import { type docs_v1, docs as googleDocs } from "@googleapis/docs"
import { type drive_v3, drive as googleDrive } from "@googleapis/drive"
import { OwidGoogleAuth } from "../../OwidGoogleAuth.js"
import * as cheerio from "cheerio"
import type { AnyNode } from "domhandler"
import {
    formatArchieMlLines,
    INDENT_STEP_PT,
    KEY_COLOR,
    type LineFormat,
    REF_COLOR,
    REF_FONT_SIZE_PT,
    type TextRange,
} from "./archieMlFormatting.js"

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
const FRAGMENT_STYLE_FIELDS =
    "bold,italic,underline,strikethrough,baselineOffset,link"

// Every written line gets these explicitly, so nothing is inherited from the
// paragraph Google keeps after the old content is deleted (a leftover heading
// would read back as `{.heading}`, a bullet as `* `).
const baseTextStyle: docs_v1.Schema$TextStyle = {
    foregroundColor: { color: { rgbColor: { red: 0, green: 0, blue: 0 } } },
    backgroundColor: {},
    weightedFontFamily: { fontFamily: "Arial" },
    fontSize: { magnitude: 11, unit: "PT" },
}
// Never "*": that would also reset the fragments' bold/italic/link.
const BASE_TEXT_STYLE_FIELDS =
    "foregroundColor,backgroundColor,weightedFontFamily,fontSize"

const baseParagraphStyle: docs_v1.Schema$ParagraphStyle = {
    namedStyleType: "NORMAL_TEXT",
    indentStart: { magnitude: 0, unit: "PT" },
    indentFirstLine: { magnitude: 0, unit: "PT" },
}
const BASE_PARAGRAPH_STYLE_FIELDS = "namedStyleType,indentStart,indentFirstLine"

function hexToColor(hex: string): docs_v1.Schema$OptionalColor {
    const value = parseInt(hex.slice(1), 16)
    return {
        color: {
            rgbColor: {
                red: ((value >> 16) & 0xff) / 255,
                green: ((value >> 8) & 0xff) / 255,
                blue: (value & 0xff) / 255,
            },
        },
    }
}

function lineToPlainText(line: Line): string {
    return line.fragments.map((fragment) => fragment.text).join("")
}

// The formatting overrides for one line, in logical order (reversed later):
// line colours, then the key, then refs. So refs execute first, and key and
// line colours then override only their colour, as in the add-on. Never
// `namedStyleType` or `weightedFontFamily`: they reset bold/italic.
function* formatToTextStyleRequests(
    format: LineFormat,
    lineLength: number
): Generator<docs_v1.Schema$Request> {
    // The line's text spans [1, length + 1) once inserted, so plain-text
    // offset `o` is document index `1 + o`.
    const toRange = ([start, end]: TextRange): docs_v1.Schema$Range => ({
        startIndex: 1 + start,
        endIndex: 1 + end,
    })

    // Google rejects styles on an empty range.
    if (lineLength === 0) return

    if (format.lineColors) {
        yield {
            updateTextStyle: {
                range: toRange([0, lineLength]),
                textStyle: {
                    foregroundColor: hexToColor(format.lineColors.foreground),
                    backgroundColor: hexToColor(format.lineColors.background),
                },
                fields: "foregroundColor,backgroundColor",
            },
        }
    }
    if (format.keyRange) {
        yield {
            updateTextStyle: {
                range: toRange(format.keyRange),
                textStyle: { foregroundColor: hexToColor(KEY_COLOR) },
                fields: "foregroundColor",
            },
        }
    }
    for (const refRange of format.refRanges) {
        yield {
            updateTextStyle: {
                range: toRange(refRange),
                textStyle: {
                    foregroundColor: hexToColor(REF_COLOR),
                    fontSize: { magnitude: REF_FONT_SIZE_PT, unit: "PT" },
                },
                fields: "foregroundColor,fontSize",
            },
        }
    }
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
                // Written as literal text: a paragraph break would split the
                // line. Keeps the enclosing style so a surrounding <b> or <a>
                // still covers it.
                yield { text: "<br>", style: mergeStyleStack(styleStack) }
            }
            yield* convertCheerioNodesToTextFragments(node.children, styleStack)
        }
    }
}

// Requests for one line, in *logical* order. The whole list is reversed
// afterwards so that every insert can target index 1; after reversal this
// executes bottom-up: the line's paragraph is created and given its base
// paragraph and text style while still empty, then the text is inserted into
// it and inherits both, then the formatting overrides run last.
//
// The base styles must run before the text exists: applying `namedStyleType`
// or `weightedFontFamily` to a range resets the bold/italic of the text in it.
function* lineToRequests(
    line: Line,
    format: LineFormat,
    isLastLine: boolean
): Generator<docs_v1.Schema$Request> {
    // Formatting overrides: sub-ranges of the line, which spans
    // [1, text length + 1) once the text is in.
    yield* formatToTextStyleRequests(format, lineToPlainText(line).length)

    for (const fragment of line.fragments) {
        // Reversed later: the style is emitted before the text so that it
        // executes right after the text is inserted.
        yield {
            updateTextStyle: {
                range: {
                    startIndex: 1,
                    endIndex: fragment.text.length + 1,
                },
                textStyle: fragment.style,
                fields: FRAGMENT_STYLE_FIELDS,
            },
        }
        yield {
            insertText: {
                location: { index: 1 },
                text: fragment.text,
            },
        }
    }

    // The still-empty paragraph: just its newline, which for the last line is
    // the document's final newline. Text inserted at index 1 inherits the
    // style of that newline.
    const emptyParagraph: docs_v1.Schema$Range = { startIndex: 1, endIndex: 2 }
    const indent = format.indentLevel * INDENT_STEP_PT
    yield {
        updateTextStyle: {
            range: emptyParagraph,
            textStyle: baseTextStyle,
            fields: BASE_TEXT_STYLE_FIELDS,
        },
    }
    yield {
        updateParagraphStyle: {
            range: emptyParagraph,
            paragraphStyle: {
                ...baseParagraphStyle,
                indentStart: { magnitude: indent, unit: "PT" },
                indentFirstLine: { magnitude: indent, unit: "PT" },
            },
            fields: BASE_PARAGRAPH_STYLE_FIELDS,
        },
    }

    // The last line reuses the document's final paragraph instead.
    if (!isLastLine) {
        yield {
            insertText: {
                location: { index: 1 },
                text: "\n",
            },
        }
    }
}

function archieMlTextToLines(text: string): Line[] {
    const rawLines = text.split("\n")
    // A trailing "\n" terminates the last line; it doesn't start a new one.
    if (rawLines.length > 1 && rawLines[rawLines.length - 1] === "")
        rawLines.pop()

    let isInsideHtmlBlock = false

    return rawLines.map((line) => {
        const styleStack: docs_v1.Schema$TextStyle[] = []
        // By convention our html blocks always end with an :end specifier
        // (the archieml construct to allow properties to be multiline). This
        // makes it easy to find the beginning and end of html blocks here,
        // which we should *not* parse with cheerio since this is meant to be
        // literal html that we want to output as-is.
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
        } else if (line === "") {
            // No empty fragment: Google rejects an insert of "" and a style
            // on the empty range it would leave. The line is just its
            // styled empty paragraph, like a blank line outside the block.
            fragments = []
        } else fragments = [{ text: line, style: mergeStyleStack(styleStack) }]
        return { fragments }
    })
}

/**
 * Requests that insert the given ArchieML text at the start of an empty
 * document, one paragraph per line, each with an explicit base paragraph and
 * text style. Inline HTML (`<b>`, `<i>`, `<a>`, …) becomes styled runs, and
 * every line gets the add-on's ArchieML formatting (indent, colours, refs).
 */
export function archieMlTextToRequests(text: string): docs_v1.Schema$Request[] {
    const lines = archieMlTextToLines(text)
    // Indent depends on earlier lines, so format all lines at once.
    const formats = formatArchieMlLines(lines.map(lineToPlainText))

    const requests = lines.flatMap((line, i) => [
        ...lineToRequests(line, formats[i], i === lines.length - 1),
    ])

    // The requests are in their logical order here. To work in one batch
    // update we insert in reverse order, so every insert can hit index 1.
    return requests.toReversed()
}

/**
 * Requests that replace the whole content of `document` with `text`:
 * the delete, the bullet removal and the inserts, meant for one batchUpdate
 * so a failed write can't leave an empty doc.
 */
export function buildReplaceDocumentRequests(
    document: docs_v1.Schema$Document,
    text: string
): docs_v1.Schema$Request[] {
    const requests: docs_v1.Schema$Request[] = []

    const content = document.body?.content
    // An empty document is [sectionBreak, paragraph] with endIndex 2.
    const endIndex = content?.[content.length - 1]?.endIndex ?? 2
    if (endIndex > 2) {
        // Google keeps the final newline, so this leaves one empty paragraph.
        requests.push({
            deleteContentRange: {
                range: { startIndex: 1, endIndex: endIndex - 1 },
            },
        })
    }

    // The surviving paragraph may still be a list item. Remove its bullets
    // before inserting: removing them later re-adds indent to replace the
    // nesting level.
    requests.push({
        deleteParagraphBullets: {
            range: { startIndex: 1, endIndex: 2 },
        },
    })

    requests.push(...archieMlTextToRequests(text))
    return requests
}

/**
 * Thrown when the doc changed since the caller read it, so the write is
 * refused. Either our own check saw a newer revision before writing, or Google
 * refused the batchUpdate because of `writeControl.requiredRevisionId`.
 */
export class StaleRevisionError extends Error {
    constructor(
        readonly expectedRevisionId: string,
        readonly currentRevisionId: string | undefined
    ) {
        super(
            `The document changed since it was read (current revision ` +
                `${currentRevisionId ?? "unknown"}, expected ` +
                `${expectedRevisionId}).`
        )
        this.name = "StaleRevisionError"
    }
}

// Google answers a batchUpdate whose `requiredRevisionId` is no longer the
// latest with an HTTP 400 that mentions the required revision.
function isRequiredRevisionError(error: unknown): boolean {
    if (!(error instanceof Error)) return false
    const status = (error as { status?: unknown }).status
    const code = (error as { code?: unknown }).code
    const isBadRequest = status === 400 || code === 400 || code === "400"
    return isBadRequest && /required revision/i.test(error.message)
}

/**
 * Replaces the content of a Google Doc with ArchieML text, written as-is, in
 * a single batchUpdate. Pass `requiredRevisionId` to refuse the write when the
 * doc has changed since: we compare it with the fetched revision first, and
 * Google checks it again at write time for the race window. Both cases throw
 * a `StaleRevisionError`.
 *
 * Returns the revision id of the doc after the write.
 */
export async function replaceGdocContentWithArchieMlText(
    documentId: string,
    text: string,
    options: { requiredRevisionId?: string } = {}
): Promise<string | undefined> {
    const { requiredRevisionId } = options
    const auth = OwidGoogleAuth.getGoogleReadWriteAuth()
    const client = googleDocs({ version: "v1", auth })

    // No suggestionsViewMode: the indices must match the stored doc that
    // batchUpdate edits, pending suggestions included.
    const { data: document } = await client.documents.get({ documentId })
    if (requiredRevisionId && document.revisionId !== requiredRevisionId) {
        throw new StaleRevisionError(
            requiredRevisionId,
            document.revisionId ?? undefined
        )
    }
    const requests = buildReplaceDocumentRequests(document, text)

    try {
        const { data } = await client.documents.batchUpdate({
            documentId,
            requestBody: {
                requests,
                writeControl: requiredRevisionId
                    ? { requiredRevisionId }
                    : undefined,
            },
        })
        return data.writeControl?.requiredRevisionId ?? undefined
    } catch (error) {
        if (requiredRevisionId && isRequiredRevisionError(error)) {
            throw new StaleRevisionError(requiredRevisionId, undefined)
        }
        throw error
    }
}

export async function createGdoc(
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
