export interface DbRawLatestWork {
    id: string
    slug: string
    title: string
    subtitle: string | null
    authors: string
    "featured-image": string | null
    isDeprecated: 0 | 1
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
        "featured-image": latestWork.isDeprecated
            ? "/archived-thumbnail.jpg"
            : latestWork["featured-image"],
    }
}
