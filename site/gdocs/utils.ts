import { useContext, createContext } from "react"
import {
    CalloutFunction,
    ImageMetadata,
    LinkedChart,
    OwidGdocPostContent,
    OwidGdocMinimalPostInterface,
    LinkedIndicator,
    OwidGdocDataInsightContent,
    ContentGraphLinkType,
    OwidGdocDataInsightInterface,
    OwidGdocPostInterface,
    OwidEnrichedGdocBlockTypeMap,
    LinkedStaticViz,
} from "@ourworldindata/types"

import {
    getCanonicalUrl,
    getLinkType,
    getUrlTarget,
} from "@ourworldindata/components"
import {
    formatAuthors,
    getCalloutValue,
    makeLinkedCalloutKey,
    traverseEnrichedBlock,
    Url,
} from "@ourworldindata/utils"
import { AttachmentsContext } from "./AttachmentsContext.js"
import { PROD_URL } from "../SiteConstants.js"
import { BAKED_BASE_URL, IS_ARCHIVE } from "../../settings/clientSettings.js"

const getOrigin = (url: string, base?: string): string | undefined => {
    try {
        return new URL(url, base).origin
    } catch {
        return undefined
    }
}

export function isExternalUrl(
    linkType: ContentGraphLinkType,
    url: string
): boolean {
    if (linkType !== ContentGraphLinkType.Url) return false
    const bakedOrigin = getOrigin(BAKED_BASE_URL)
    if (!bakedOrigin) return false
    const linkOrigin = getOrigin(url, bakedOrigin)
    if (!linkOrigin) return false
    return linkOrigin !== bakedOrigin
}

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

export const getLinkedDocumentUrl = (
    linkedDocument: Pick<OwidGdocMinimalPostInterface, "slug" | "type">,
    originalUrl: string,
    baseUrl: string = BAKED_BASE_URL
): string => {
    if (IS_ARCHIVE) {
        baseUrl = PROD_URL
    }
    const canonicalUrl = getCanonicalUrl(baseUrl, {
        slug: linkedDocument.slug,
        content: { type: linkedDocument.type },
    })
    const hash = Url.fromURL(originalUrl).hash
    return `${canonicalUrl}${hash}`
}

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
            url: getLinkedDocumentUrl(linkedDocument, url),
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

    const parsedOriginalUrl = Url.fromURL(url)
    const urlTarget = getUrlTarget(url)
    const linkedChart = linkedCharts?.[urlTarget]
    if (!linkedChart) {
        return {
            errorMessage: `${linkType} chart with slug ${urlTarget} not found`,
        }
    }

    const parsedResolvedUrl = Url.fromURL(linkedChart.resolvedUrl)
    const resolvedUrl = parsedResolvedUrl.setQueryParams({
        ...parsedResolvedUrl.queryParams,
        ...parsedOriginalUrl.queryParams,
    }).fullUrl

    return { linkedChart: { ...linkedChart, resolvedUrl } }
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

export const useLinkedStaticViz = (
    name: string
): LinkedStaticViz | undefined => {
    const { linkedStaticViz } = useContext(AttachmentsContext)
    return linkedStaticViz?.[name]
}

/**
 * Context provided to span-callout spans within a data-callout block.
 * Contains the URL and entity from the parent data-callout, and the
 * linked callout data from attachments.
 */
export interface DataCalloutContextType {
    url: string
}

export const DataCalloutContext = createContext<DataCalloutContextType | null>(
    null
)

export function useCalloutValue(
    functionName: CalloutFunction,
    parameters: string[]
): string | undefined {
    const { linkedCallouts = {} } = useContext(AttachmentsContext)
    const calloutContext = useContext(DataCalloutContext)

    if (!calloutContext) return undefined

    const key = makeLinkedCalloutKey(calloutContext.url)

    const linkedCallout = linkedCallouts[key]

    if (!linkedCallout?.values) return undefined

    return getCalloutValue(linkedCallout.values, functionName, parameters)
}

export function getShortPageCitation(
    authors: string[],
    title: string,
    publishedAt: Date | null
) {
    return `${formatAuthors(authors)} (${publishedAt?.getFullYear()}) - “${title}”`
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
