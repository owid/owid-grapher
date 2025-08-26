import * as React from "react"
import { observer } from "mobx-react"
import * as _ from "lodash-es"
import * as R from "remeda"
import { computed, makeObservable } from "mobx"
import { Bar, BarShape, PlacedItem } from "./MarimekkoChartConstants"
import { DualAxis } from "../axis/Axis"
import { Bounds } from "@ourworldindata/utils"
import { Halo } from "@ourworldindata/components"

interface MarimekkoInternalLabelsProps {
    items: PlacedItem[]
    dualAxis: DualAxis
    x0: number
    y0: number
    fontSize: number
    labelPadding: number
}

interface PlacedLabel {
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

    @computed get sortedItems(): PlacedItem[] {
        return _.sortBy(
            this.props.items,
            (item) => item.xPoint?.value ?? item.xPosition
        )
    }

    @computed get placedLabels(): PlacedLabel[] {
        return this.sortedItems
            .map((item) => {
                const bar: Bar | undefined = item.bars[0]
                if (bar === undefined) return undefined

                const x =
                    this.props.dualAxis.horizontalAxis.place(this.props.x0) +
                    item.xPosition

                const barY =
                    bar === undefined
                        ? this.props.dualAxis.verticalAxis.place(
                              this.props.y0
                          ) -
                          (Bounds.forText("no data").height + 10)
                        : this.props.dualAxis.verticalAxis.place(
                              bar.yPoint.value
                          )
                const y = barY - this.props.labelPadding

                const label = item.shortEntityName ?? item.entityName
                const bounds = Bounds.forText(label, {
                    fontSize: this.props.fontSize,
                }).set({ x, y })

                const color =
                    item.entityColor?.color ??
                    (bar.kind === BarShape.Bar ? bar.color : "#555")

                return { bounds, label, color }
            })
            .filter((label) => label !== undefined)
    }

    @computed get visibleLabels(): PlacedLabel[] {
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
