import type { Feed } from "./feed.js"
import type { EntityId, IndexKey, OutcomeKey, PanelPoint } from "./types.js"

export interface PointFilters {
    mutedContinents: ReadonlySet<string>
    showSmallCountries: boolean
}

/**
 * The dots of one panel for one year: entities with a democracy score AND a value of the measure
 * (each within its tolerance), not muted by the legend, and past the population threshold.
 */
export function panelPoints(
    feed: Feed,
    xKey: IndexKey,
    yKey: OutcomeKey,
    year: number,
    filters: PointFilters
): PanelPoint[] {
    const out: PanelPoint[] = []
    for (let eid = 0; eid < feed.entities.length; eid++) {
        if (filters.mutedContinents.has(feed.continentOf[eid])) continue
        if (!feed.passesPopulationFilter(eid, year, filters.showSmallCountries))
            continue
        const xv = feed.valueAt(xKey, eid, year)
        if (!xv) continue
        const yv = feed.outcomeAt(yKey, eid, year)
        if (!yv) continue
        out.push({
            eid,
            x: xv.value,
            y: yv.value,
            xYear: xv.year,
            yYear: yv.year,
            pop: feed.popAt(eid, year),
            px: 0,
            py: 0,
        })
    }
    return out
}

/** One population domain for the whole view, so a bubble means the same thing in every panel */
export function maxPopulation(
    feed: Feed,
    year: number,
    showSmallCountries: boolean
): number {
    let max = 0
    for (let eid = 0; eid < feed.entities.length; eid++) {
        if (!feed.passesPopulationFilter(eid, year, showSmallCountries))
            continue
        const pop = feed.popAt(eid, year)
        if (pop !== null && pop > max) max = pop
    }
    return max
}

export function selectedIds(
    feed: Feed,
    names: readonly string[]
): Set<EntityId> {
    const ids = new Set<EntityId>()
    for (const name of names) {
        const eid = feed.entityId(name)
        if (eid !== undefined) ids.add(eid)
    }
    return ids
}
