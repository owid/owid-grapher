export interface DbRawLatestWork {
    id: string
    slug: string
    title: string
    subtitle: string | null
    authors: string
    "featured-image": string | null
    publishedAt: string
}

export interface DbEnrichedLatestWork {
    id: string
    slug: string
    title: string
    subtitle: string | null
    authors: string[]
    "featured-image": string | null
    publishedAt: string
}

export const parseLatestWork = (
    latestWork: DbRawLatestWork
): DbEnrichedLatestWork => {
    return {
        ...latestWork,
        authors: JSON.parse(latestWork.authors),
    }
}
