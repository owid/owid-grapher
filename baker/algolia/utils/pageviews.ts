export type PageviewsByUrl = Record<
    string,
    { views_7d: number; views_14d: number; views_365d: number }
>

export interface MultiWindowPageviews {
    views_7d: number
    views_14d: number
    views_365d: number
}

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

export function getMaxViewsAllWindows(
    pageviews: PageviewsByUrl,
    urls: string[]
): MultiWindowPageviews {
    let max7d = 0
    let max14d = 0
    let max365d = 0
    for (const url of urls) {
        const pv = pageviews[url]
        if (pv) {
            if (pv.views_7d > max7d) max7d = pv.views_7d
            if (pv.views_14d > max14d) max14d = pv.views_14d
            if (pv.views_365d > max365d) max365d = pv.views_365d
        }
    }
    return { views_7d: max7d, views_14d: max14d, views_365d: max365d }
}
