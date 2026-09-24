/**
 * Data perspectives — prototype fixtures.
 *
 * A data perspective is one alternative view of the page's own chart: a title,
 * and the grapher config that produces the view (the query string of a
 * grapher URL). That's all it is.
 */
export interface DataPerspective {
    title: string
    /**
     * Grapher query string, without the leading "?". Empty means the chart's
     * default view. Anything not set falls back to the chart's own defaults,
     * exactly as the same URL would on the live site — including the tab, so a
     * perspective with no `tab` opens on the chart's default tab.
     */
    queryParams: string
}

export const DATA_PERSPECTIVES: Record<string, DataPerspective[]> = {
    "prevalence-of-undernourishment": [
        {
            title: "How has hunger changed in different world regions?",
            queryParams: "",
        },
        {
            title: "In most regions hunger has declined since 2010, but in Africa it has increased",
            queryParams: "tab=dumbbell&time=2010..latest",
        },
        {
            title: "How hunger has changed in countries around the world in the last two decades",
            queryParams: "tab=map&time=2003..latest",
        },
        {
            title: "Hunger has declined in Angola, Ethiopia, Nepal, and Mongolia",
            queryParams: "country=AGO~ETH~NPL~MNG",
        },
        {
            title: "The latest data on hunger, globally",
            queryParams: "tab=map",
        },
    ],
}

export function getDataPerspectives(
    slug: string | undefined
): DataPerspective[] {
    if (!slug) return []
    return DATA_PERSPECTIVES[slug] ?? []
}
