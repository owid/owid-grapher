/* AxisBox.tsx
 * ================
 *
 * Standard axis box layout model. Precompute before rendering and pass it around.
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-02-11
 */

import { action, computed, observable, reaction } from "mobx"
import { observer } from "mobx-react"
import * as React from "react"

import { AxisScale } from "./AxisScale"
import { AxisSpec } from "./AxisSpec"
import { Bounds } from "./Bounds"
import { HorizontalAxis, HorizontalAxisView } from "./HorizontalAxis"
import { ScaleType } from "./ScaleType"
import { extend } from "./Util"
import { VerticalAxis, VerticalAxisView } from "./VerticalAxis"

interface AxisBoxProps {
    bounds: Bounds
    fontSize: number
    xAxis: AxisSpec
    yAxis: AxisSpec
}

// AxisBox has the important task of coordinating two axes so that they work together!
// There is a *two-way dependency* between the bounding size of each axis.
// e.g. if the y axis becomes wider because a label is present, the x axis then has less
// space to work with, and vice versa
export class AxisBox {
    props: AxisBoxProps

    @observable targetYDomain: [number, number] = [1, 100]
    @observable targetXDomain: [number, number] = [1, 100]
    @observable prevYDomain: [number, number] = [1, 100]
    @observable prevXDomain: [number, number] = [1, 100]
    @observable animProgress?: number
    private frameStart?: number

    constructor(props: AxisBoxProps) {
        this.props = props
    }

    @computed.struct get currentYDomain(): [number, number] {
        if (this.animProgress === undefined) return this.props.yAxis.domain

        const [prevMinY, prevMaxY] = this.prevYDomain
        const [targetMinY, targetMaxY] = this.targetYDomain

        return [
            prevMinY + (targetMinY - prevMinY) * this.animProgress,
            prevMaxY + (targetMaxY - prevMaxY) * this.animProgress
        ]
    }

    @computed.struct get currentXDomain(): [number, number] {
        if (this.animProgress === undefined) return this.props.xAxis.domain

        const [prevMinX, prevMaxX] = this.prevXDomain
        const [targetMinX, targetMaxX] = this.targetXDomain

        return [
            prevMinX + (targetMinX - prevMinX) * this.animProgress,
            prevMaxX + (targetMaxX - prevMaxX) * this.animProgress
        ]
    }

    @action.bound setupAnimation() {
        this.targetYDomain = this.props.yAxis.domain
        this.targetXDomain = this.props.xAxis.domain
        this.animProgress = 1

        reaction(
            () => [this.props.yAxis.domain, this.props.xAxis.domain],
            () => {
                this.prevXDomain = this.currentXDomain
                this.prevYDomain = this.currentYDomain
                this.targetYDomain = this.props.yAxis.domain
                this.targetXDomain = this.props.xAxis.domain
                this.animProgress = 0
                requestAnimationFrame(this.frame)
            }
        )
    }

    @action.bound frame(timestamp: number) {
        if (this.animProgress === undefined) return

        if (!this.frameStart) this.frameStart = timestamp
        this.animProgress = Math.min(
            1,
            this.animProgress + (timestamp - this.frameStart) / 300
        )

        if (this.animProgress < 1) requestAnimationFrame(this.frame)
        else this.frameStart = undefined
    }

    @computed get yAxisSpec() {
        return extend({}, this.props.yAxis, { domain: this.currentYDomain })
    }

    @computed get xAxisSpec() {
        return extend({}, this.props.xAxis, { domain: this.currentXDomain })
    }

    // We calculate an initial width/height for the axes in isolation
    @computed get xAxisHeight() {
        return new HorizontalAxis({
            scale: new AxisScale(this.xAxisSpec).extend({
                range: [0, this.props.bounds.width]
            }),
            labelText: this.xAxisSpec.label,
            fontSize: this.props.fontSize
        }).height
    }

    @computed get yAxisWidth() {
        return new VerticalAxis({
            scale: new AxisScale(this.yAxisSpec).extend({
                range: [0, this.props.bounds.height]
            }),
            labelText: this.yAxisSpec.label,
            fontSize: this.props.fontSize
        }).width
    }

    // Now we can determine the "true" inner bounds of the axis box
    @computed get innerBounds(): Bounds {
        return this.props.bounds
            .padBottom(this.xAxisHeight)
            .padLeft(this.yAxisWidth)
    }

    @computed get xScale() {
        return new AxisScale(this.xAxisSpec).extend({
            range: this.innerBounds.xRange()
        })
    }

    @computed get yScale() {
        return new AxisScale(this.yAxisSpec).extend({
            range: this.innerBounds.yRange()
        })
    }

    @computed get xAxis() {
        const that = this
        return new HorizontalAxis({
            get scale() {
                return that.xScale
            },
            get labelText() {
                return that.xAxisSpec.label
            },
            get fontSize() {
                return that.props.fontSize
            }
        })
    }

    @computed get yAxis() {
        const that = this
        return new VerticalAxis({
            get scale() {
                return that.yScale
            },
            get labelText() {
                return that.yAxisSpec.label
            },
            get fontSize() {
                return that.props.fontSize
            }
        })
    }

    @computed get bounds() {
        return this.props.bounds
    }
}

interface AxisGridLinesProps {
    orient: "left" | "bottom"
    scale: AxisScale
    bounds: Bounds
}

@observer
export class AxisGridLines extends React.Component<AxisGridLinesProps> {
    render() {
        const { orient, bounds } = this.props
        const scale = this.props.scale.extend({
            range: orient === "left" ? bounds.yRange() : bounds.xRange()
        })

        return (
            <g className="AxisGridLines">
                {scale.getTickValues().map((v, i) => {
                    if (orient === "left")
                        return (
                            <line
                                key={i}
                                x1={bounds.left.toFixed(2)}
                                y1={scale.place(v)}
                                x2={bounds.right.toFixed(2)}
                                y2={scale.place(v)}
                                stroke={v === 0 ? "#ccc" : "#ddd"}
                                strokeDasharray={v !== 0 ? "3,2" : undefined}
                            />
                        )
                    else
                        return (
                            <line
                                key={i}
                                x1={scale.place(v)}
                                y1={bounds.bottom.toFixed(2)}
                                x2={scale.place(v)}
                                y2={bounds.top.toFixed(2)}
                                stroke={v === 0 ? "#ccc" : "#ddd"}
                                strokeDasharray={v !== 0 ? "3,2" : undefined}
                            />
                        )
                })}
            </g>
        )
    }
}

export interface AxisBoxViewProps {
    axisBox: AxisBox
    onYScaleChange: (scaleType: ScaleType) => void
    onXScaleChange: (scaleType: ScaleType) => void
    highlightValue?: { x: number; y: number }
}

@observer
export class AxisBoxView extends React.Component<AxisBoxViewProps> {
    componentDidMount() {
        requestAnimationFrame(this.props.axisBox.setupAnimation)
    }

    render() {
        const { axisBox, onYScaleChange, onXScaleChange } = this.props
        const { bounds, xScale, yScale, xAxis, yAxis, innerBounds } = axisBox

        return (
            <g className="AxisBoxView">
                <HorizontalAxisView
                    bounds={bounds}
                    axis={xAxis}
                    onScaleTypeChange={onXScaleChange}
                />
                <VerticalAxisView
                    bounds={bounds}
                    axis={yAxis}
                    onScaleTypeChange={onYScaleChange}
                />
                {!yScale.hideGridlines && (
                    <AxisGridLines
                        orient="left"
                        scale={yScale}
                        bounds={innerBounds}
                    />
                )}
                {!xScale.hideGridlines && (
                    <AxisGridLines
                        orient="bottom"
                        scale={xScale}
                        bounds={innerBounds}
                    />
                )}
            </g>
        )
    }
}
