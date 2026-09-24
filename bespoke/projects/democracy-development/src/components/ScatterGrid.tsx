import { useCallback, useMemo, useState } from "react"
import cx from "clsx"

import { ContinentColors } from "@ourworldindata/grapher/src/color/CustomSchemes.js"

import { usePinnedTooltip } from "../../../../hooks/usePinnedTooltip.js"
import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"

import {
    DEFAULT_DOT_COLOR,
    DEFAULT_DOT_RADIUS,
    INDICATOR_SPECS,
} from "../core/constants.js"
import { getGridLayout, makeRadiusScale } from "../core/layout.js"
import type {
    AxisRange,
    DemocracyAxis,
    HoverState,
    IndicatorKey,
    ScatterPoint,
} from "../core/types.js"
import { RegionLegend } from "./RegionLegend.js"
import { ScatterPanel } from "./ScatterPanel.js"

const CONTINENT_COLORS: Record<string, string> = ContinentColors

export function getContinentColor(continent: string): string {
    return CONTINENT_COLORS[continent] ?? DEFAULT_DOT_COLOR
}

export function ScatterGrid({
    pointsByIndicator,
    rangesByIndicator,
    year,
    democracyAxis,
    colorByRegion,
    sizeByPopulation,
    showTriangles,
    selectedEntity,
}: {
    pointsByIndicator: Record<IndicatorKey, ScatterPoint[]>
    rangesByIndicator: Record<IndicatorKey, AxisRange>
    year: number
    democracyAxis: DemocracyAxis
    colorByRegion: boolean
    sizeByPopulation: boolean
    showTriangles: boolean
    selectedEntity: string | undefined
}): React.ReactElement {
    const [hover, setHover] = useState<HoverState | undefined>(undefined)
    const clearHover = useCallback(() => setHover(undefined), [])
    const { ref: pinnedRef, isPinned } = usePinnedTooltip<HTMLDivElement>(
        hover !== undefined,
        clearHover
    )

    // Measure the grid itself: the frame's padding and border sit between
    // it and the variant's outer width
    const { width, ref: widthRef } = useContainerWidth()
    const layout = getGridLayout(width)

    const getColor = useCallback(
        (point: ScatterPoint) =>
            colorByRegion
                ? getContinentColor(point.continent)
                : DEFAULT_DOT_COLOR,
        [colorByRegion]
    )

    const maxPopulation = useMemo(
        () =>
            Math.max(
                0,
                ...Object.values(pointsByIndicator)
                    .flat()
                    .map((p) => p.population ?? 0)
            ),
        [pointsByIndicator]
    )
    const getRadius = useMemo(() => {
        if (!sizeByPopulation) return () => DEFAULT_DOT_RADIUS
        const scale = makeRadiusScale(maxPopulation)
        return (point: ScatterPoint) => scale(point.population)
    }, [sizeByPopulation, maxPopulation])

    const continentsShown = useMemo(
        () =>
            [
                ...new Set(
                    Object.values(pointsByIndicator)
                        .flat()
                        .map((p) => p.continent)
                ),
            ].sort(),
        [pointsByIndicator]
    )

    return (
        <div
            ref={pinnedRef}
            className={cx("democracy-grid", {
                "democracy-grid--single-column": layout.columns === 1,
            })}
        >
            {colorByRegion && (
                <RegionLegend
                    continents={continentsShown}
                    getColor={getContinentColor}
                />
            )}
            <div
                ref={widthRef}
                className="democracy-grid__panels"
                style={{ gap: layout.gap }}
            >
                {width > 0 &&
                    INDICATOR_SPECS.map((spec) => (
                        <ScatterPanel
                            key={spec.key}
                            spec={spec}
                            range={rangesByIndicator[spec.key]}
                            points={pointsByIndicator[spec.key]}
                            year={year}
                            width={layout.panelWidth}
                            plotHeight={layout.plotHeight}
                            democracyAxis={democracyAxis}
                            getColor={getColor}
                            getRadius={getRadius}
                            showPopulation={sizeByPopulation}
                            showTriangle={showTriangles}
                            hover={hover}
                            selectedEntity={selectedEntity}
                            isPinned={isPinned}
                            onHover={setHover}
                        />
                    ))}
            </div>
        </div>
    )
}
