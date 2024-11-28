export interface ApiChartViewOverview {
    id: number
    slug: string
    parent: {
        id: number
        title: string
    }
    updatedAt: string | null
    lastEditedByUser: string | null
    chartConfigId: string
    title: string
}
