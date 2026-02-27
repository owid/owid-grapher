import React, { useMemo } from "react"
import cx from "classnames"
import { SimpleMarkdownText } from "@ourworldindata/components"
import { InteractionState } from "../interaction/InteractionState.js"
import { RegionMap } from "./RegionMap"
import { buildCountryMap, TooltipRegion } from "./RegionTooltipData.js"
import { useStateWithDebouncedClear } from "../hooks.js"

export function RegionTooltip({
    description,
    regions,
    initiallyHighlightedRegion,
}: {
    description: string
    regions: TooltipRegion[]
    initiallyHighlightedRegion: string
}): React.ReactElement {
    const [activeRegion, setActiveRegion, clearActiveRegion] =
        useStateWithDebouncedClear(initiallyHighlightedRegion)

    const countries = useMemo(() => buildCountryMap(regions), [regions])

    return (
        <div
            className="region-tooltip"
            // Stop mouse events from bubbling through the React portal boundary.
            // Without this, events reach the parent chart's handlers (e.g. LineChart's
            // onMouseMove) because React portals propagate synthetic events through
            // the React component tree, not the DOM tree
            onMouseMove={(e) => e.stopPropagation()}
            onMouseEnter={(e) => e.stopPropagation()}
            onMouseLeave={(e) => e.stopPropagation()}
        >
            <SimpleMarkdownText text={description} />
            <div className="map-container">
                <RegionMap
                    countries={countries}
                    highlightedRegion={activeRegion}
                    onRegionHover={setActiveRegion}
                    onRegionLeave={clearActiveRegion}
                />
            </div>
            <RegionLegend
                regions={regions}
                highlightedRegion={activeRegion}
                onRegionHover={setActiveRegion}
                onRegionLeave={clearActiveRegion}
            />
        </div>
    )
}

function RegionLegend({
    regions,
    highlightedRegion,
    onRegionHover,
    onRegionLeave,
}: {
    regions: TooltipRegion[]
    highlightedRegion?: string
    onRegionHover: (name: string) => void
    onRegionLeave: () => void
}): React.ReactElement {
    return (
        <ul className="legend">
            {regions.map((region) => (
                <RegionLegendItem
                    key={region.name}
                    region={region}
                    interaction={InteractionState.for(
                        region.name,
                        highlightedRegion
                    )}
                    onPointerEnter={() => onRegionHover(region.name)}
                    onPointerLeave={onRegionLeave}
                />
            ))}
        </ul>
    )
}

function RegionLegendItem({
    region,
    interaction,
    onPointerEnter,
    onPointerLeave,
}: {
    region: TooltipRegion
    interaction: InteractionState
    onPointerEnter: () => void
    onPointerLeave: () => void
}): React.ReactElement {
    return (
        <li
            className={cx("legend-item", { muted: interaction.background })}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
        >
            <span
                className="swatch"
                style={{ backgroundColor: region.color }}
            />
            {region.displayName}
        </li>
    )
}
