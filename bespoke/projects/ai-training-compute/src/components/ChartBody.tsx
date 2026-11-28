import { useState } from "react"
import * as R from "remeda"

import { ResponsiveContainer } from "../../../../components/ResponsiveContainer/ResponsiveContainer.js"

import { ComputeScatter } from "./ComputeScatter.js"
import { Legend } from "./Legend.js"
import { TimeRangeSlider } from "./TimeRangeSlider.js"
import { getModels } from "../core/data.js"
import { FIRST_YEAR, LAST_YEAR } from "../core/constants.js"
import { SHOWN_COMPUTERS } from "../core/computers.js"
import { REFERENCE_POINTS } from "../core/referencePoints.js"
import { FRONTIER_SEGMENTS } from "../core/frontier.js"
import { ViewState } from "../core/viewState.js"

/**
 * The legend, the chart and the time slider under it, for a given view.
 * Shared by the plain chart and the walkthroughs.
 */
export function ChartBody({
    view,
    animate,
    labeledModels,
    onTimeRangeChange,
}: {
    view: ViewState
    /** Whether the last change of view should animate */
    animate: boolean
    labeledModels: string[]
    /** Without it, there's no time slider */
    onTimeRangeChange?: (range: [number, number]) => void
}) {
    // A focused legend group belongs to one color scheme
    const [focus, setFocus] = useState<{ scheme: string; group: string }>()
    const focusedGroup =
        focus?.scheme === view.colorScheme ? focus.group : undefined

    const models = getModels(view.modelFilter)
    const [startYear, endYear] = view.timeRange
    const isInRange = (year: number): boolean =>
        year >= startYear && year <= endYear
    const counts = new Map(
        Object.entries(
            R.countBy(
                models.filter((m) => isInRange(m.year)),
                (m) => m.groups[view.colorScheme]
            )
        )
    )
    const computers = view.showComputers ? SHOWN_COMPUTERS : []
    const computerKinds = R.unique(
        computers.filter((c) => isInRange(c.year)).map((c) => c.kind)
    )

    return (
        <>
            <Legend
                colorScheme={view.colorScheme}
                counts={counts}
                focusedGroup={focusedGroup}
                onFocusChange={(group) =>
                    setFocus(
                        group ? { scheme: view.colorScheme, group } : undefined
                    )
                }
                computerKinds={computerKinds}
            />
            <div className="ai-training-compute__chart-area">
                <ResponsiveContainer>
                    {({ width, height }) => (
                        <ComputeScatter
                            width={width}
                            height={height}
                            models={models}
                            computers={computers}
                            referencePoints={
                                view.showThresholds ? REFERENCE_POINTS : []
                            }
                            labeledModels={labeledModels}
                            timeRange={view.timeRange}
                            animateTransitions={animate}
                            colorScheme={view.colorScheme}
                            focusedGroup={focusedGroup}
                            frontierSegments={
                                view.showFrontier
                                    ? FRONTIER_SEGMENTS
                                    : undefined
                            }
                            showUncertainty={view.showUncertainty}
                            yScaleType={view.yScaleType}
                        />
                    )}
                </ResponsiveContainer>
            </div>
            {onTimeRangeChange && (
                <TimeRangeSlider
                    min={FIRST_YEAR}
                    max={LAST_YEAR}
                    range={[
                        Math.round(view.timeRange[0]),
                        Math.round(view.timeRange[1]),
                    ]}
                    onChange={onTimeRangeChange}
                />
            )}
        </>
    )
}
