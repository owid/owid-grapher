import React, { useCallback, useMemo, useRef } from "react"
import { Bounds, MapRegionName } from "@ourworldindata/utils"
import { getGeoFeaturesForMap } from "../mapCharts/GeoFeatures"

const NO_DATA_COLOR = "#f2f2f2"
const STROKE_COLOR = "#e7e7e7"
const STROKE_WIDTH = 0.3
const MUTED_OPACITY = 0.4

interface RegionProviderMapProps {
    countryColorMap: Map<string, string>
    countryRegionMap: Map<string, string>
    highlightColor?: string
    onRegionHover?: (region: string | undefined) => void
}

export function RegionProviderMap({
    countryColorMap,
    countryRegionMap,
    highlightColor,
    onRegionHover,
}: RegionProviderMapProps): React.ReactElement {
    const features = getGeoFeaturesForMap(MapRegionName.World)
    const clearTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined
    )

    const handleHover = useCallback(
        (countryName: string | undefined) => {
            if (clearTimer.current) clearTimeout(clearTimer.current)
            const region = countryName
                ? countryRegionMap.get(countryName)
                : undefined
            if (region) {
                onRegionHover?.(region)
            } else {
                clearTimer.current = setTimeout(
                    () => onRegionHover?.(undefined),
                    200
                )
            }
        },
        [countryRegionMap, onRegionHover]
    )

    const viewBox = useMemo(() => {
        const allBounds = features.map((f) => f.projBounds)
        const merged = Bounds.merge(allBounds)
        const padding = 2
        return `${merged.x - padding} ${merged.y - padding} ${merged.width + padding * 2} ${merged.height + padding * 2}`
    }, [features])

    return (
        <svg
            className="region-provider-tooltip__map"
            viewBox={viewBox}
            preserveAspectRatio="xMidYMid meet"
            onPointerLeave={() => handleHover(undefined)}
        >
            {features.map((feature) => {
                const color = countryColorMap.get(feature.id)
                const hasRegion = color !== undefined
                const isMuted =
                    highlightColor !== undefined && color !== highlightColor
                return (
                    <path
                        key={feature.id}
                        d={feature.path}
                        fill={color ?? NO_DATA_COLOR}
                        fillOpacity={isMuted ? MUTED_OPACITY : 1}
                        stroke={STROKE_COLOR}
                        strokeWidth={STROKE_WIDTH}
                        onPointerEnter={() =>
                            handleHover(hasRegion ? feature.id : undefined)
                        }
                        onPointerLeave={() => handleHover(undefined)}
                    />
                )
            })}
        </svg>
    )
}
