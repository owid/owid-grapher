import {
    OwidGdocPostContent,
    EnrichedBlockText,
    EnrichedBlockSimpleText,
} from "@ourworldindata/utils"
import {
    propertyToArchieMLString,
    encloseLinesAsPropertyPossiblyMultiline,
    OwidRawGdocBlockToArchieMLStringGenerator,
} from "./rawToArchie.js"
import { GDOCS_BACKPORTING_TARGET_FOLDER } from "../../../settings/serverSettings.js"
import { enrichedBlockToRawBlock } from "./enrichedToRaw.js"
import { type docs_v1, docs as googleDocs } from "@googleapis/docs"
import { type drive_v3, drive as googleDrive } from "@googleapis/drive"
import { OwidGoogleAuth } from "../../OwidGoogleAuth.js"
import * as cheerio from "cheerio"
import type { AnyNode } from "domhandler"

function* yieldMultiBlockPropertyIfDefined(
    property: keyof OwidGdocPostContent,
    article: OwidGdocPostContent,
    target: (EnrichedBlockText | EnrichedBlockSimpleText)[] | undefined
): Generator<string, void, undefined> {
    if (property in article && target) {
        yield* encloseLinesAsPropertyPossiblyMultiline(
            property,
            target.flatMap((item) => [
                ...OwidRawGdocBlockToArchieMLStringGenerator(
                    enrichedBlockToRawBlock(item)
                ),
            ])
        )
    }
}

function* owidArticleToArchieMLStringGenerator(
    article: OwidGdocPostContent
): Generator<string, void, undefined> {
    yield* propertyToArchieMLString("title", article)
    yield* propertyToArchieMLString("subtitle", article)
    yield* propertyToArchieMLString("supertitle", article)
    yield* propertyToArchieMLString("authors", article)
    yield* propertyToArchieMLString("dateline", article)
    yield* propertyToArchieMLString("excerpt", article)
    yield* propertyToArchieMLString("type", article)
    if (article["sticky-nav"]) {
        yield "[.sticky-nav]"
        for (const item of article["sticky-nav"]) {
            yield* propertyToArchieMLString("target", item)
            yield* propertyToArchieMLString("text", item)
        }
        yield "[]"
    }
    yield* propertyToArchieMLString("sidebar-toc", article)
    // TODO: inline refs
    yieldMultiBlockPropertyIfDefined("summary", article, article.summary)
    yield* propertyToArchieMLString("hide-citation", article)
    yield* propertyToArchieMLString("cover-image", article)
    yield* propertyToArchieMLString("cover-color", article)
    yield* propertyToArchieMLString("featured-image", article)
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

function articleToBatchUpdates(
    content: OwidGdocPostContent
): docs_v1.Schema$Request[] {
    const archieMlLines = [...owidArticleToArchieMLStringGenerator(content)]

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

    // The batch updates are in their logical order here. To work in one batch update
    // we want to insert gdoc DOM spans in reverse order, so we reverse the batches here.
    // The code above already works under the assumption that the batches will be reversed.
    return batchUpdates.toReversed()
}

async function deleteGdocContent(
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
    content: OwidGdocPostContent,
    existingGdocId: string | null
): Promise<string> {
    const batchUpdates = articleToBatchUpdates(content)

    const targetFolder = GDOCS_BACKPORTING_TARGET_FOLDER
    if (targetFolder === undefined || targetFolder === "")
        throw new Error("GDOCS_BACKPORTING_TARGET_FOLDER is not set")
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
