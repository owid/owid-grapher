export interface DbRawLatestWork {
    slug: string
    title: string
    authors: string
    "featured-image": string
    publishedAt: Date | null
}

export interface DbEnrichedLatestWork {
    slug: string
    title: string
    authors: string[]
    "featured-image": string
    publishedAt: Date | null
}

export const parseLatestWork = (
    latestWork: DbRawLatestWork
): DbEnrichedLatestWork => {
    return {
        ...latestWork,
        authors: JSON.parse(latestWork.authors),
    }
}
