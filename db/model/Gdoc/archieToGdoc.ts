import {
    Span,
    RawBlockHorizontalRule,
    RawBlockImage,
    RawBlockHeading,
    OwidArticleContent,
    EnrichedBlockText,
    EnrichedBlockSimpleText,
} from "@ourworldindata/utils"
import { spanToHtmlString } from "./gdocUtils"
import {
    keyValueToArchieMlString,
    propertyToArchieMLString,
    encloseLinesAsPropertyPossiblyMultiline,
    owidRawArticleBlockToArchieMLStringGenerator,
} from "./rawToArchie.js"
import { match, P } from "ts-pattern"
import { enrichedBlockToRawBlock } from "./enrichtedToRaw.js"
import { google, Auth, drive_v3, docs_v1 } from "googleapis"
import { Gdoc } from "./Gdoc.js"
import * as cheerio from "cheerio"
import { style } from "d3"

function* yieldMultiBlockPropertyIfDefined(
    property: keyof OwidArticleContent,
    article: OwidArticleContent,
    target: (EnrichedBlockText | EnrichedBlockSimpleText)[] | undefined
): Generator<string, void, undefined> {
    if (property in article && target) {
        article[property]
        yield* encloseLinesAsPropertyPossiblyMultiline(
            property,
            target.flatMap((item) => [
                ...owidRawArticleBlockToArchieMLStringGenerator(
                    enrichedBlockToRawBlock(item)
                ),
            ])
        )
    }
}

function* owidArticleToArchieMLStringGenerator(
    article: OwidArticleContent
): Generator<string, void, undefined> {
    yield* propertyToArchieMLString("title", article)
    yield* propertyToArchieMLString("subtitle", article)
    yield* propertyToArchieMLString("supertitle", article)
    yield* propertyToArchieMLString("template", article)
    yield* propertyToArchieMLString("byline", article)
    yield* propertyToArchieMLString("dateline", article)
    yield* propertyToArchieMLString("excerpt", article)
    // TODO: inline refs
    yieldMultiBlockPropertyIfDefined("summary", article, article.summary)
    yieldMultiBlockPropertyIfDefined("citation", article, article.summary)
    yield* propertyToArchieMLString("cover-image", article)
    yield* propertyToArchieMLString("cover-color", article)
    yield* propertyToArchieMLString("featured-image", article)
    if (article.body) {
        yield "[+body]"
        for (const block of article.body) {
            const rawBlock = enrichedBlockToRawBlock(block)
            const lines = [
                ...owidRawArticleBlockToArchieMLStringGenerator(rawBlock),
            ]
            yield* lines
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
function mergeStyleStack(styleStack: docs_v1.Schema$TextStyle[]) {
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
                // The first text inserted into the document must create a paragraph,
                // which can't be done with the `location` property.  Use the
                // `endOfSegmentLocation` instead, which assumes the Body if
                // unspecified.
                location: {
                    index: 1,
                },
                text: fragment.text,
            },
        }
    }
}

function articleToBatchUpdates(
    article: OwidArticleContent
): docs_v1.Schema$Request[] {
    const archieMlLines = [...owidArticleToArchieMLStringGenerator(article)]

    const lines: Line[] = archieMlLines.map((line) => {
        const styleStack: docs_v1.Schema$TextStyle[] = []
        // Cheerio.load has 3 params. Cheerio 1.0.0-rc.10 which we are using is
        // written in typescript, so the below should work without the ugly
        // any cast. But enzyme also uses cheerio and pulls in 1.0.0-rc.3 which
        // was not yet in typescript and thus also pulls in @types/cheerio which
        // does not have the correct signature for load with the third param and
        // which seems to win the battle in the TS load order. Thus the any cast
        const $ = (cheerio as any).load(line, null, false)
        const fragments: TextFragment[] = [
            ...convertCheerioNodesToTextFragments(
                $.root().contents() as Iterable<CheerioElement>,
                styleStack
            ),
        ]
        return { fragments }
    })

    const batchUpdates: docs_v1.Schema$Request[] = lines.flatMap((l) => [
        ...lineToBatchUpdates(l),
    ])

    batchUpdates.reverse()
    return batchUpdates
}

export async function createGdocAndInsertOwidArticleContent(
    article: OwidArticleContent
): Promise<string> {
    const batchUpdates = articleToBatchUpdates(article)

    const docsMimeType = "application/vnd.google-apps.document"
    const targetFolder = "1JNP-guV4nYh6-ql_z5xOagfSnSy2LIP2"
    const auth = Gdoc.getGoogleAuth()
    const client = google.docs({
        version: "v1",
        auth,
    })
    const driveClient = google.drive({
        version: "v3",
        auth,
    })
    const createResp = await driveClient.files.create({
        supportsAllDrives: true,
        requestBody: {
            parents: [targetFolder],
            mimeType: docsMimeType,
            name: article.title,
        },
        media: {
            mimeType: docsMimeType,
            body: "",
        },
    })
    const documentId = createResp.data.id!

    // const { data } = await client.documents.create({
    //     requestBody: {
    //         title: article.title,
    //     },
    // })

    await client.documents.batchUpdate({
        // The ID of the document to update.
        documentId,

        // Request body metadata
        requestBody: {
            requests: batchUpdates,
        },
    })

    // const resp = await client.documents.get({
    //     documentId: documentId,
    // })
    // console.log(JSON.stringify(resp.data.body, undefined, 2))

    // const deleteRes = await driveClient.files.delete({
    //     fileId: data.documentId!,
    // })
    // console.log("deleteRes status", deleteRes.status)
    // console.log("deleteRes statustext", deleteRes.statusText)

    return documentId
}
