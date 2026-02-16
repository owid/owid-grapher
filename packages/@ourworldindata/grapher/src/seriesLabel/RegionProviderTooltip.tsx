import React, { useState } from "react"
import { SimpleMarkdownText } from "@ourworldindata/components"
import { RegionProviderMap } from "./RegionProviderMap"

export interface RegionProviderTooltipProps {
    description: string
    countryColorMap: Map<string, string>
    countryRegionMap: Map<string, string>
    regions: { name: string; color?: string }[]
    currentRegion?: string
}

export function RegionProviderTooltip({
    description,
    countryColorMap,
    countryRegionMap,
    regions,
    currentRegion,
}: RegionProviderTooltipProps): React.ReactElement {
    const defaultRegion = currentRegion ?? regions[0]?.name
    const [hasInteracted, setHasInteracted] = useState(false)
    const [hoveredRegionFromMap, setHoveredRegionFromMap] = useState<
        string | undefined
    >(undefined)
    const [hoveredLegendRegion, setHoveredLegendRegion] = useState<
        string | undefined
    >(undefined)

    // Priority: legend hover > map hover > (default region only if no interaction yet)
    const hoveredRegion = hoveredLegendRegion ?? hoveredRegionFromMap
    const activeRegion =
        hoveredRegion ?? (hasInteracted ? undefined : defaultRegion)

    // Resolve highlight color from the active region
    const highlightColor = activeRegion
        ? regions.find((r) => r.name === activeRegion)?.color
        : undefined

    return (
        <div className="region-provider-tooltip">
            <SimpleMarkdownText text={description} />
            <div className="region-provider-tooltip__map-container">
                <RegionProviderMap
                    countryColorMap={countryColorMap}
                    countryRegionMap={countryRegionMap}
                    highlightColor={highlightColor}
                    onRegionHover={(region) => {
                        setHasInteracted(true)
                        setHoveredRegionFromMap(region)
                    }}
                />
            </div>
            <ul
                className="region-provider-tooltip__region-list"
                onPointerLeave={() => setHoveredLegendRegion(undefined)}
            >
                {regions.map((region) => {
                    const isHighlighted = region.name === activeRegion
                    const isMuted = activeRegion !== undefined && !isHighlighted
                    return (
                        <li
                            key={region.name}
                            className={`region-provider-tooltip__region${isHighlighted ? " region-provider-tooltip__region--highlighted" : ""}${isMuted ? " region-provider-tooltip__region--muted" : ""}`}
                            onPointerEnter={() => {
                                setHasInteracted(true)
                                setHoveredLegendRegion(region.name)
                            }}
                            onPointerLeave={() =>
                                setHoveredLegendRegion(undefined)
                            }
                        >
                            <span
                                className="region-provider-tooltip__region-dot"
                                style={{
                                    backgroundColor: region.color ?? "#cccccc",
                                }}
                            />
                            {region.name}
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
