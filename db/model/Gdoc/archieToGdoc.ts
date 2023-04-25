import {
    OwidGdocContent,
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
import { google, docs_v1, drive_v3 } from "googleapis"
import { Gdoc } from "./Gdoc.js"
import cheerio from "cheerio"

function* yieldMultiBlockPropertyIfDefined(
    property: keyof OwidGdocContent,
    article: OwidGdocContent,
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
    article: OwidGdocContent
): Generator<string, void, undefined> {
    yield* propertyToArchieMLString("title", article)
    yield* propertyToArchieMLString("subtitle", article)
    yield* propertyToArchieMLString("supertitle", article)
    yield* propertyToArchieMLString("template", article)
    yield* propertyToArchieMLString("authors", article)
    yield* propertyToArchieMLString("dateline", article)
    yield* propertyToArchieMLString("excerpt", article)
    // TODO: inline refs
    yieldMultiBlockPropertyIfDefined("summary", article, article.summary)
    yieldMultiBlockPropertyIfDefined("citation", article, article.summary)
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
    nodes: Iterable<CheerioElement>,
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
    content: OwidGdocContent
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
        // Cheerio.load has 3 params. Cheerio 1.0.0-rc.10 which we are using is
        // written in typescript, so the below should work without the ugly
        // any cast. But enzyme also uses cheerio and pulls in 1.0.0-rc.3 which
        // was not yet in typescript and thus also pulls in @types/cheerio which
        // does not have the correct signature for load with the third param and
        // which seems to win the battle in the TS load order. Thus the any cast
        let fragments: TextFragment[]
        if (!isInsideHtmlBlock) {
            const $ = (cheerio as any).load(line, null, false)
            fragments = [
                ...convertCheerioNodesToTextFragments(
                    $.root().contents() as Iterable<CheerioElement>,
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
    batchUpdates.reverse()
    return batchUpdates
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

export async function createGdocAndInsertOwidGdocContent(
    content: OwidGdocContent,
    existingGdocId: string | null
): Promise<string> {
    const batchUpdates = articleToBatchUpdates(content)

    const targetFolder = GDOCS_BACKPORTING_TARGET_FOLDER
    if (targetFolder === undefined || targetFolder === "")
        throw new Error("GDOCS_BACKPORTING_TARGET_FOLDER is not set")
    const auth = Gdoc.getGoogleReadWriteAuth()
    const client = google.docs({
        version: "v1",
        auth,
    })
    const driveClient = google.drive({
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
