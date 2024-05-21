export interface DbRawAuthor {
    slug: string
    title: string
}

export interface DbEnrichedAuthor {
    slug: string | null
    title: string
}

export interface DbRawLatestWork {
    id: string
    slug: string
    title: string
    subtitle: string | null
    authors: string
    "featured-image": string | null
    publishedAt: string | null
}

export interface DbEnrichedLatestWork {
    id: string
    slug: string
    title: string
    subtitle: string | null
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
