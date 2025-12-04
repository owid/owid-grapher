export type PageviewsByUrl = Record<string, { views_7d: number }>

export function getMaxViews7d(
    pageviews: PageviewsByUrl,
    urls: string[]
): number {
    let maxViews = 0
    for (const url of urls) {
        const views = pageviews[url]?.views_7d ?? 0
        if (views > maxViews) maxViews = views
    }
    return maxViews
}
