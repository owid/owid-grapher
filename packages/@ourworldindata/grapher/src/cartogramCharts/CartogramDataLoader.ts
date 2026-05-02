import {
    buildCartogramLayout,
    CartogramLayout,
    parseCartogramCsv,
} from "./CartogramFeatures"
import {
    CARTOGRAM_LAYOUTS,
    CartogramLayoutDefinition,
    findClosestCartogramLayout,
} from "./CartogramLayouts"
import { Time } from "@ourworldindata/types"

const layoutCache = new Map<string, Promise<CartogramLayout>>()

export function loadCartogramLayout(
    layout: CartogramLayoutDefinition
): Promise<CartogramLayout> {
    const cached = layoutCache.get(layout.url)
    if (cached) return cached

    const promise = fetch(layout.url)
        .then((response) => {
            if (!response.ok)
                throw new Error(
                    `Failed to load cartogram layout ${layout.url}: ${response.status}`
                )
            return response.text()
        })
        .then((csv) =>
            buildCartogramLayout({
                year: layout.year,
                url: layout.url,
                cells: parseCartogramCsv(csv),
            })
        )

    layoutCache.set(layout.url, promise)
    return promise
}

export function loadCartogramLayoutForTargetTime(
    targetYear: Time | undefined,
    layouts: readonly CartogramLayoutDefinition[] = CARTOGRAM_LAYOUTS
): Promise<CartogramLayout> {
    return loadCartogramLayout(findClosestCartogramLayout(targetYear, layouts))
}

export function clearCartogramLayoutCache(): void {
    layoutCache.clear()
}
