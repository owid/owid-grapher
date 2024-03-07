export interface DbRawLatestWork {
    id: string
    slug: string
    title: string
    authors: string
    "featured-image": string | null
    publishedAt: string | null
}

export interface DbEnrichedLatestWork {
    id: string
    slug: string
    title: string
    authors: string[]
    "featured-image": string | null
    publishedAt: string | null
}

export const parseLatestWork = (
    latestWork: DbRawLatestWork
): DbEnrichedLatestWork => {
    return {
        ...latestWork,
        authors: JSON.parse(latestWork.authors),
    }
}
