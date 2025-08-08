import { useContext } from "react"

import {
    getCanonicalUrl,
    getLinkType,
    getUrlTarget,
} from "@ourworldindata/components"
import {
    ImageMetadata,
    LinkedChart,
    OwidGdocPostContent,
    OwidGdocMinimalPostInterface,
    LinkedIndicator,
    OwidGdocDataInsightContent,
    ContentGraphLinkType,
    SubNavId,
    OwidGdocDataInsightInterface,
    OwidGdocPostInterface,
    OwidEnrichedGdocBlockTypeMap,
} from "@ourworldindata/types"
import {
    formatAuthors,
    traverseEnrichedBlock,
    Url,
} from "@ourworldindata/utils"
import { AttachmentsContext } from "./AttachmentsContext.js"
import { SubnavItem, subnavs } from "../SiteConstants.js"
import { BAKED_BASE_URL } from "../../settings/clientSettings.js"

export const breadcrumbColorForCoverColor = (
    coverColor: OwidGdocPostContent["cover-color"]
): "white" | "blue" => {
    // exhaustive list of all possible cover colors
    switch (coverColor) {
        case "sdg-color-1": // red
        case "sdg-color-3": // green
        case "sdg-color-4": // red
        case "sdg-color-5": // orange-red
        case "sdg-color-8": // dark red
        case "sdg-color-10": // purple
        case "sdg-color-13": // dark green
        case "sdg-color-14": // blue
        case "sdg-color-16": // blue
        case "sdg-color-17": // dark blue
            return "white"
        case "sdg-color-2": // orange
        case "sdg-color-6": // light blue
        case "sdg-color-7": // yellow
        case "sdg-color-9": // orange
        case "sdg-color-11": // yellow orange
        case "sdg-color-12": // yellow-brown
        case "sdg-color-15": // light green
        case "amber": // amber
        case undefined: // default cover color: blue-10
            return "blue"
    }
}

export const useLinkedAuthor = (
    name: string
): { name: string; slug: string | null; featuredImage: string | null } => {
    const { linkedAuthors } = useContext(AttachmentsContext)
    const author = linkedAuthors?.find((author) => author.name === name)
    if (!author) return { name, slug: null, featuredImage: null }
    return author
}

type LinkedDocument = OwidGdocMinimalPostInterface & { url: string }

export const useLinkedDocument = (
    url: string
): { linkedDocument?: LinkedDocument; errorMessage?: string } => {
    const { linkedDocuments } = useContext(AttachmentsContext)
    let errorMessage: string | undefined = undefined
    let linkedDocument: OwidGdocMinimalPostInterface | undefined = undefined
    const linkType = getLinkType(url)
    if (linkType !== ContentGraphLinkType.Gdoc) {
        return { linkedDocument }
    }

    const urlTarget = getUrlTarget(url)
    linkedDocument = linkedDocuments?.[urlTarget] as
        | OwidGdocMinimalPostInterface
        | undefined

    if (!linkedDocument) {
        errorMessage = `Google doc URL ${url} isn't registered.`
        return { errorMessage }
    } else if (!linkedDocument.published) {
        errorMessage = `Article with slug "${linkedDocument.slug}" isn't published.`
    }

    return {
        linkedDocument: {
            ...linkedDocument,
            url: getCanonicalUrl(BAKED_BASE_URL, {
                slug: linkedDocument.slug,
                content: { type: linkedDocument.type },
            }),
        },
        errorMessage,
    }
}

export const useLinkedChart = (
    url: string
): { linkedChart?: LinkedChart; errorMessage?: string } => {
    const { linkedCharts } = useContext(AttachmentsContext)
    const linkType = getLinkType(url)
    if (linkType !== "grapher" && linkType !== "explorer") return {}

    const queryString = Url.fromURL(url).queryStr
    const urlTarget = getUrlTarget(url)
    const linkedChart = linkedCharts?.[urlTarget]
    if (!linkedChart) {
        return {
            errorMessage: `${linkType} chart with slug ${urlTarget} not found`,
        }
    }

    return {
        linkedChart: {
            ...linkedChart,
            // linkedCharts doesn't store any querystring information, because it's indexed by slug
            // Instead we get the querystring from the original URL and append it to resolvedUrl
            resolvedUrl: `${linkedChart.resolvedUrl}${queryString}`,
        },
    }
}

export const useLinkedIndicator = (
    id: number
): { linkedIndicator?: LinkedIndicator; errorMessage?: string } => {
    const { linkedIndicators } = useContext(AttachmentsContext)

    const linkedIndicator = linkedIndicators?.[id]

    if (!linkedIndicator) {
        return {
            errorMessage: `Indicator with id ${id} not found`,
        }
    }

    return { linkedIndicator }
}

export const useImage = (
    filename: string | undefined
): ImageMetadata | undefined => {
    const { imageMetadata } = useContext(AttachmentsContext)
    if (!filename) return
    const metadata = imageMetadata[filename]
    return metadata
}

export function useDonors(): string[] | undefined {
    const { donors } = useContext(AttachmentsContext)
    return donors
}

export const useLinkedNarrativeChart = (name: string) => {
    const { linkedNarrativeCharts } = useContext(AttachmentsContext)
    return linkedNarrativeCharts?.[name]
}

export function getShortPageCitation(
    authors: string[],
    title: string,
    publishedAt: Date | null
) {
    return `${formatAuthors(authors)} (${publishedAt?.getFullYear()}) - “${title}”`
}

export const getSubnavItem = (
    id: string | undefined,
    subnavItems: SubnavItem[]
) => {
    // We want to avoid matching elements with potentially undefined id.
    // Static typing prevents id from being undefined but this might not be
    // the case in a future API powered version.
    return id ? subnavItems.find((item) => item.id === id) : undefined
}

export const getTopSubnavigationParentItem = (
    subnavId: SubNavId
): SubnavItem | undefined => {
    return subnavs[subnavId]?.[0]
}

/**
 * Takes a gdoc, block type, and number n and returns up to n first consecutive
 * blocks of the specified type e.g. takeConsecutiveBlocksOfType(gdoc, "text",
 * 3) will return up to 3 consecutive text blocks from the gdoc.
 *
 * If there are 2 text blocks, 1 image block, and then another text block, it
 * will return only the first 2 consecutive text blocks.
 **/
export function takeConsecutiveBlocksOfType<
    T extends keyof OwidEnrichedGdocBlockTypeMap,
>(
    gdoc: OwidGdocPostInterface | OwidGdocDataInsightInterface,
    type: T,
    n: number
): OwidEnrichedGdocBlockTypeMap[T][] {
    if (!gdoc.content.body || n <= 0) return []
    const foundBlocks: OwidEnrichedGdocBlockTypeMap[T][] = []

    let startedCollecting = false
    for (const block of gdoc.content.body) {
        if (foundBlocks.length >= n) break

        if (block.type === type) {
            foundBlocks.push(block as OwidEnrichedGdocBlockTypeMap[T])
            startedCollecting = true
        } else if (startedCollecting) {
            // We've started collecting blocks of the desired type, but this block is not of that type
            // So we stop collecting consecutive blocks
            break
        }
        // If we haven't started collecting yet and this isn't the right type, continue looking
    }

    return foundBlocks
}

/**
 * Takes a gdoc and a block type and returns the first block of that type found in the gdoc
 * e.g. getFirstBlockOfType(gdoc, "image") will return the first image block in the gdoc
 * and it will be typed correctly as an EnrichedBlockImage
 **/
export function getFirstBlockOfType<
    T extends keyof OwidEnrichedGdocBlockTypeMap,
>(
    gdoc: OwidGdocPostInterface | OwidGdocDataInsightInterface,
    type: T
): OwidEnrichedGdocBlockTypeMap[T] | undefined {
    if (!gdoc.content.body) return undefined
    for (const block of gdoc.content.body) {
        let foundBlock: OwidEnrichedGdocBlockTypeMap[T] | undefined
        traverseEnrichedBlock(block, (node) => {
            if (!foundBlock && node.type === type) {
                foundBlock = node as OwidEnrichedGdocBlockTypeMap[T]
            }
        })
        if (foundBlock) return foundBlock
    }
    return undefined
}

// Always use the smallFilename for old data insights, where two filenames were always provided
// Doing this in code was simpler than migrating all the DI gdocs themselves
// See https://github.com/owid/owid-grapher/issues/4416
export function addPreferSmallFilenameToDataInsightImages(
    content: OwidGdocDataInsightContent
): OwidGdocDataInsightContent {
    content.body.forEach((node) =>
        traverseEnrichedBlock(node, (block) => {
            if (block.type === "image") {
                block.preferSmallFilename = true
            }
        })
    )
    return content
}
