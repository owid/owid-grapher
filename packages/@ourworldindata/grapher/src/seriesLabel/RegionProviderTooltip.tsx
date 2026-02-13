import React, { useState } from "react"
import { SimpleMarkdownText } from "@ourworldindata/components"
import { RegionProviderMap } from "./RegionProviderMap"

export interface RegionProviderTooltipProps {
    description: string
    countryColorMap: Map<string, string>
    countryRegionMap: Map<string, string>
    regions: { name: string; color?: string }[]
}

export function RegionProviderTooltip({
    description,
    countryColorMap,
    countryRegionMap,
    regions,
}: RegionProviderTooltipProps): React.ReactElement {
    const [hoveredCountry, setHoveredCountry] = useState<string | undefined>()
    const [hoveredLegendRegion, setHoveredLegendRegion] = useState<
        string | undefined
    >()

    const hoveredRegionFromMap = hoveredCountry
        ? countryRegionMap.get(hoveredCountry)
        : undefined
    const hoveredRegion = hoveredLegendRegion ?? hoveredRegionFromMap

    // Resolve highlight color from whichever hover source is active
    const highlightColor = hoveredLegendRegion
        ? regions.find((r) => r.name === hoveredLegendRegion)?.color
        : hoveredCountry
          ? countryColorMap.get(hoveredCountry)
          : undefined

    return (
        <div className="region-provider-tooltip">
            <SimpleMarkdownText text={description} />
            <div className="region-provider-tooltip__map-container">
                <RegionProviderMap
                    countryColorMap={countryColorMap}
                    highlightColor={highlightColor}
                    onCountryHover={setHoveredCountry}
                />
                {hoveredCountry && !hoveredLegendRegion && (
                    <span className="region-provider-tooltip__country-label">
                        {hoveredCountry}
                    </span>
                )}
            </div>
            <ul
                className="region-provider-tooltip__region-list"
                onPointerLeave={() => setHoveredLegendRegion(undefined)}
            >
                {regions.map((region) => {
                    const isHighlighted = region.name === hoveredRegion
                    const isMuted =
                        hoveredRegion !== undefined && !isHighlighted
                    return (
                        <li
                            key={region.name}
                            className={`region-provider-tooltip__region${isHighlighted ? " region-provider-tooltip__region--highlighted" : ""}${isMuted ? " region-provider-tooltip__region--muted" : ""}`}
                            onPointerEnter={() =>
                                setHoveredLegendRegion(region.name)
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
