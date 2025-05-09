import { DbRawImage } from "@ourworldindata/types"

export interface ApiNarrativeChartOverview {
    id: number
    name: string
    parent: {
        id: number
        title: string
    }
    updatedAt: string | null
    lastEditedByUser: string | null
    chartConfigId: string
    title: string
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
