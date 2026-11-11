import { DbRawImage } from "@ourworldindata/types"

export interface ApiNarrativeChartOverview {
    id: number
    name: string
    parent: {
        type: "chart" | "multiDim"
        title: string
        url: string | null
    }
    updatedAt: string | null
    lastEditedByUser: string | null
    chartConfigId: string
    title: string
}

/** A multi-dim as the admin's list of them shows it */
export interface ApiMultiDimOverview {
    id: number
    catalogPath: string
    title: string
    slug: string | null
    updatedAt: string
    published: boolean
    /** The names of its dimensions, in the order its page lists them */
    dimensions: string[]
    /** Its topic tags, as named in its ETL config */
    tags: string[]
    /** How many views it has, one per combination of dimension choices */
    mdimViews: number
    /** Average daily views of its page over the last 365 days */
    viewsPerDay: number
    narrativeChartsCount: number
    /** Published gdocs and static visualizations that link to it */
    referencesCount: number
}

export interface ApiSlideshowOverview {
    id: number
    slug: string
    title: string
    isPublished: number
    updatedAt: string | null
    authorName: string
}

export interface DataInsightMinimalInformation {
    gdocId: string
    title: string
    published: boolean
    narrativeChart?: string
    figmaUrl?: string
    image?: {
        id: NonNullable<DbRawImage["id"]>
        filename: NonNullable<DbRawImage["filename"]>
        cloudflareId: NonNullable<DbRawImage["cloudflareId"]>
        originalWidth: NonNullable<DbRawImage["originalWidth"]>
    }
}
