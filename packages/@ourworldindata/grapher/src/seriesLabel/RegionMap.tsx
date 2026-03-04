import React, { useMemo } from "react"
import cx from "classnames"
import { Bounds, EntityName, MapRegionName } from "@ourworldindata/utils"
import { getGeoFeaturesForMap } from "../mapCharts/GeoFeatures"
import { InteractionState } from "../interaction/InteractionState.js"
import { GRAY_10 } from "../color/ColorConstants.js"

const NO_DATA_COLOR = GRAY_10

export function RegionMap({
    countries,
    highlightedRegion,
    onRegionHover,
    onRegionLeave,
}: {
    countries: Map<EntityName, { region: EntityName; color: string }>
    highlightedRegion?: EntityName
    onRegionHover?: (regionName: EntityName) => void
    onRegionLeave?: () => void
}): React.ReactElement {
    const features = getGeoFeaturesForMap(MapRegionName.World)

    const viewBox = useMemo(() => {
        const allBounds = features.map((f) => f.projBounds)
        return Bounds.merge(allBounds).toViewBox()
    }, [features])

    return (
        <svg className="map" viewBox={viewBox} onPointerLeave={onRegionLeave}>
            {features.map((feature) => {
                const entry = countries.get(feature.id)
                return (
                    <CountryPath
                        key={feature.id}
                        path={feature.path}
                        color={entry?.color ?? NO_DATA_COLOR}
                        interaction={InteractionState.for(
                            entry?.region,
                            highlightedRegion
                        )}
                        onPointerEnter={
                            entry
                                ? () => onRegionHover?.(entry.region)
                                : onRegionLeave
                        }
                        onPointerLeave={onRegionLeave}
                    />
                )
            })}
        </svg>
    )
}

function CountryPath({
    path,
    color,
    interaction,
    onPointerEnter,
    onPointerLeave,
}: {
    path: string
    color: string
    interaction: InteractionState
    onPointerEnter?: () => void
    onPointerLeave?: () => void
}): React.ReactElement {
    return (
        <path
            className={cx({ muted: interaction.background })}
            d={path}
            fill={color}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
        />
    )
}
