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
