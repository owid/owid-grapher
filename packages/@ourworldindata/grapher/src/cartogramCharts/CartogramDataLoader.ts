import {
    buildCartogramLayout,
    CartogramLayout,
    parseCartogramCsv,
} from "./CartogramFeatures"
import {
    CARTOGRAM_LAYOUT_INDEX_URL,
    CARTOGRAM_LAYOUTS,
    CartogramLayoutDefinition,
    findClosestCartogramLayout,
} from "./CartogramLayouts"
import { Time } from "@ourworldindata/types"

interface CartogramLayoutIndex {
    layouts?: CartogramLayoutDefinition[]
}

const layoutCache = new Map<string, Promise<CartogramLayout>>()
let layoutIndexCache: Promise<readonly CartogramLayoutDefinition[]> | undefined

function isValidLayoutDefinition(
    layout: CartogramLayoutDefinition
): layout is CartogramLayoutDefinition {
    return (
        typeof layout?.year === "number" &&
        Number.isFinite(layout.year) &&
        typeof layout.url === "string" &&
        layout.url.length > 0
    )
}

export function loadCartogramLayoutIndex(): Promise<
    readonly CartogramLayoutDefinition[]
> {
    if (layoutIndexCache) return layoutIndexCache

    layoutIndexCache = fetch(CARTOGRAM_LAYOUT_INDEX_URL)
        .then(async (response): Promise<readonly CartogramLayoutDefinition[]> => {
            if (!response.ok) return CARTOGRAM_LAYOUTS
            const index = (await response.json()) as CartogramLayoutIndex
            const layouts = Array.isArray(index) ? index : index.layouts
            const validLayouts = Array.isArray(layouts)
                ? layouts.filter(isValidLayoutDefinition)
                : []
            return validLayouts.length > 0 ? validLayouts : CARTOGRAM_LAYOUTS
        })
        .catch(() => CARTOGRAM_LAYOUTS)

    return layoutIndexCache
}

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
    layouts?: readonly CartogramLayoutDefinition[]
): Promise<CartogramLayout> {
    const layoutsPromise = layouts ? Promise.resolve(layouts) : loadCartogramLayoutIndex()
    return layoutsPromise.then((availableLayouts) =>
        loadCartogramLayout(findClosestCartogramLayout(targetYear, availableLayouts))
    )
}

export function clearCartogramLayoutCache(): void {
    layoutCache.clear()
    layoutIndexCache = undefined
}
