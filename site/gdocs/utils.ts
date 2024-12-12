import { useContext } from "react"

import { getLinkType, getUrlTarget } from "@ourworldindata/components"
import {
    ImageMetadata,
    LinkedChart,
    OwidGdocPostContent,
    OwidGdocMinimalPostInterface,
    OwidGdocType,
    LinkedIndicator,
    CategoryWithEntries,
    EntryMeta,
    SubNavId,
} from "@ourworldindata/types"
import { formatAuthors, Url } from "@ourworldindata/utils"
import { AttachmentsContext } from "./AttachmentsContext.js"
import { SiteNavigationStatic, SubnavItem, subnavs } from "../SiteConstants.js"

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

export const useLinkedDocument = (
    url: string
): { linkedDocument?: OwidGdocMinimalPostInterface; errorMessage?: string } => {
    const { linkedDocuments } = useContext(AttachmentsContext)
    let errorMessage: string | undefined = undefined
    let linkedDocument: OwidGdocMinimalPostInterface | undefined = undefined
    const linkType = getLinkType(url)
    if (linkType !== "gdoc") {
        return { linkedDocument }
    }

    const urlObj = Url.fromURL(url)
    const queryString = urlObj.queryStr
    const hash = urlObj.hash
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

    //todo replace with getCanonicalUrl
    const subdirectory =
        linkedDocument.type === OwidGdocType.DataInsight ? "data-insights/" : ""
    return {
        linkedDocument: {
            ...linkedDocument,
            slug: `${subdirectory}${linkedDocument.slug}${queryString}${hash}`,
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

export const useChartViewMetadata = (name: string) => {
    const { chartViewMetadata } = useContext(AttachmentsContext)
    return chartViewMetadata?.[name]
}

export function getShortPageCitation(
    authors: string[],
    title: string,
    publishedAt: Date | null
) {
    return `${formatAuthors({
        authors: authors,
    })} (${publishedAt?.getFullYear()}) - “${title}”`
}

export const allTopicsInCategory = (
    category: CategoryWithEntries
): EntryMeta[] => {
    return [
        ...category.entries,
        ...(category.subcategories ?? []).flatMap(
            (subcategory) => subcategory.entries
        ),
    ]
}

export const getUniqueTopicCount = () =>
    SiteNavigationStatic.categories
        .flatMap((category) => {
            const subcategoryEntries =
                category?.subcategories?.flatMap(
                    (subcategory) => subcategory.entries || []
                ) || []
            return [...category.entries, ...subcategoryEntries]
        })
        .map((entry) => entry.slug)
        .filter((value, index, array) => array.indexOf(value) === index).length

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
