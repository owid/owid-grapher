import { Time } from "@ourworldindata/types"

export interface CartogramLayoutDefinition {
    year: number
    url: string
}

export const CARTOGRAM_LAYOUT_INDEX_URL = "/cartograms/population/index.json"

export const CARTOGRAM_LAYOUTS = [
    { year: 2023, url: "/cartograms/population/2023.csv" },
] as const satisfies readonly CartogramLayoutDefinition[]

export function findClosestCartogramLayout(
    targetYear: Time | undefined,
    layouts: readonly CartogramLayoutDefinition[] = CARTOGRAM_LAYOUTS
): CartogramLayoutDefinition {
    if (layouts.length === 0) throw new Error("No cartogram layouts available")

    if (targetYear === undefined) return layouts[layouts.length - 1]

    return layouts.reduce((closest, layout) => {
        const closestDistance = Math.abs(closest.year - targetYear)
        const layoutDistance = Math.abs(layout.year - targetYear)
        if (layoutDistance < closestDistance) return layout
        if (layoutDistance === closestDistance && layout.year > closest.year)
            return layout
        return closest
    })
}
