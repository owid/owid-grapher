import * as React from "react"
import { observer } from "mobx-react"
import * as _ from "lodash-es"
import * as R from "remeda"
import { computed, makeObservable } from "mobx"
import { PlacedMarimekkoSeries } from "./MarimekkoChartConstants"
import { DualAxis } from "../axis/Axis"
import { Bounds } from "@ourworldindata/utils"
import { Halo } from "@ourworldindata/components"

interface MarimekkoInternalLabelsProps {
    series: PlacedMarimekkoSeries[]
    dualAxis: DualAxis
    fontSize: number
    labelPadding: number
}

interface PlacedInternalLabel {
    bounds: Bounds
    label: string
    color: string
}

@observer
export class MarimekkoInternalLabels extends React.Component<MarimekkoInternalLabelsProps> {
    constructor(props: MarimekkoInternalLabelsProps) {
        super(props)
        makeObservable(this)
    }

    @computed get sortedSeries(): PlacedMarimekkoSeries[] {
        return _.sortBy(
            this.props.series,
            (series) => series.xPoint?.value ?? series.barX
        )
    }

    @computed get placedLabels(): PlacedInternalLabel[] {
        return this.sortedSeries
            .map((series) => {
                if (series.yPoint === undefined) return undefined

                const x = series.barX

                const barY = this.props.dualAxis.verticalAxis.place(
                    series.yPoint.value
                )
                const y = barY - this.props.labelPadding

                const label = series.shortEntityName ?? series.entityName
                const bounds = Bounds.forText(label, {
                    fontSize: this.props.fontSize,
                }).set({ x, y })

                return { bounds, label, color: series.color }
            })
            .filter((label) => label !== undefined)
    }

    @computed get visibleLabels(): PlacedInternalLabel[] {
        const placedLabels = this.placedLabels.map((series) => ({
            ...series,
            // Hide label if it doesn't fit within the chart area
            isHidden:
                series.bounds.x + series.bounds.width >
                this.props.dualAxis.innerBounds.right,
        }))

        // Hide overlapping labels
        for (let i = 0; i < placedLabels.length; i++) {
            const s1 = placedLabels[i]
            if (s1.isHidden) continue

            for (let j = i + 1; j < placedLabels.length; j++) {
                const s2 = placedLabels[j]
                if (s2.isHidden) continue

                if (s1.bounds.intersects(s2.bounds)) {
                    s2.isHidden = true
                }
            }
        }

        return placedLabels
            .filter((label) => !label.isHidden)
            .map((series) => R.omit(series, ["isHidden"]))
    }

    override render(): React.ReactElement | null {
        if (!this.visibleLabels.length) return null

        return (
            <g>
                {this.visibleLabels.map(({ label, bounds, color }) => (
                    <Halo key={label} id={label} outlineWidth={2}>
                        <text
                            x={bounds.x}
                            y={bounds.y}
                            fontSize={this.props.fontSize}
                            fill={color}
                        >
                            {label}
                        </text>
                    </Halo>
                ))}
            </g>
        )
    }
}
