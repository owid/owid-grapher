// Document types for type-safe search results
export interface PageDocument {
    id: string
    type: string
    importance: number
    slug: string
    title: string
    content: string
    views_7d: number
    score: number
    excerpt?: string
    excerptLong?: string[]
    authors?: string[]
    date?: number
    modifiedDate?: number
    tags?: string[]
    thumbnailUrl: string
    availableEntities?: string[]
    embedding?: number[]
}

export interface ChartDocument {
    id: string
    deduplicationId: string
    type: string
    chartId?: number
    chartConfigId?: string
    slug: string
    title: string
    subtitle?: string
    variantName?: string
    tags?: string[]
    availableEntities?: string[]
    originalAvailableEntities?: string[]
    keyChartForTags?: string[]
    publishedAt?: number
    updatedAt?: number
    numDimensions?: number
    titleLength: number
    numRelatedArticles?: number
    score: number
    viewTitleIndexWithinExplorer?: number
    queryParams?: string
    availableTabs?: string[]
    isFM?: boolean
    isIncomeGroupSpecificFM?: boolean
    explorerType?: string
    embedding?: number[]
}
