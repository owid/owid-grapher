import { DbRawImage } from "@ourworldindata/types"

export interface ApiChartViewOverview {
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

export interface DataInsight {
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
