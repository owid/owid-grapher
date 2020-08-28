import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"

import { Bounds } from "charts/utils/Bounds"
import { getRelativeMouse, sortBy } from "charts/utils/Util"
import { ColorScaleBin, CategoricalBin } from "charts/color/ColorScaleBin"
import {
    MapColorLegend,
    MapNumericColorLegend,
    MapCategoricalColorLegend
} from "./MapColorLegend"

const FOCUS_BORDER_COLOR = "#111"

interface MapColorLegendViewProps {
    legend: MapColorLegend
    onMouseOver: (d: ColorScaleBin) => void
    onMouseLeave: () => void
}

@observer
export class MapColorLegendView extends React.Component<
    MapColorLegendViewProps
> {
    render() {
        const { legend, onMouseOver, onMouseLeave } = this.props
        const {
            bounds,
            mainLabel,
            numericLegend,
            categoryLegend,
            categoryLegendHeight
        } = legend

        return (
            <g className="mapLegend">
                {numericLegend && (
                    <NumericColorLegendView
                        legend={numericLegend}
                        x={bounds.centerX - numericLegend.width / 2}
                        y={
                            bounds.bottom -
                            mainLabel.height -
                            categoryLegendHeight -
                            numericLegend.height -
                            4
                        }
                        onMouseOver={onMouseOver}
                        onMouseLeave={onMouseLeave}
                    />
                )}
                {categoryLegend && (
                    <CategoricalColorLegendView
                        legend={categoryLegend}
                        x={bounds.centerX - categoryLegend.width / 2}
                        y={
                            bounds.bottom -
                            mainLabel.height -
                            categoryLegendHeight
                        }
                        onMouseOver={onMouseOver}
                        onMouseLeave={onMouseLeave}
                    />
                )}
                {mainLabel.render(
                    bounds.centerX - mainLabel.width / 2,
                    bounds.bottom - mainLabel.height
                )}
            </g>
        )
    }
}

@observer
class NumericColorLegendView extends React.Component<{
    legend: MapNumericColorLegend
    x: number
    y: number
    onMouseOver: (d: ColorScaleBin) => void
    onMouseLeave: () => void
}> {
    base: React.RefObject<SVGGElement> = React.createRef()

    @computed get bounds(): Bounds {
        const { props } = this
        return new Bounds(
            props.x,
            props.y,
            props.legend.width,
            props.legend.height
        )
    }

    @computed get legend(): MapNumericColorLegend {
        return this.props.legend
    }

    @action.bound onMouseMove(ev: MouseEvent | TouchEvent) {
        const { legend, props, base } = this
        const { focusBracket } = legend
        const mouse = getRelativeMouse(base.current, ev)

        // We implement onMouseMove and onMouseLeave in a custom way, without attaching them to
        // specific SVG elements, in order to allow continuous transition between bins as the user
        // moves their cursor across (even if their cursor is in the empty area above the
        // legend, where the labels are).
        // We could achieve the same by rendering invisible rectangles over the areas and attaching
        // event handlers to those.

        // If outside legend bounds, trigger onMouseLeave if there is an existing bin in focus.
        if (!this.bounds.contains(mouse)) {
            if (focusBracket) {
                return this.props.onMouseLeave()
            }
            return
        }

        // If inside legend bounds, trigger onMouseOver with the bin closest to the cursor.
        let newFocusBracket = null
        legend.positionedBins.forEach(d => {
            if (mouse.x >= props.x + d.x && mouse.x <= props.x + d.x + d.width)
                newFocusBracket = d.bin
        })

        if (newFocusBracket) this.props.onMouseOver(newFocusBracket)
    }

    componentDidMount() {
        document.documentElement.addEventListener("mousemove", this.onMouseMove)
        document.documentElement.addEventListener("touchmove", this.onMouseMove)
    }

    componentWillUnmount() {
        document.documentElement.removeEventListener(
            "mousemove",
            this.onMouseMove
        )
        document.documentElement.removeEventListener(
            "touchmove",
            this.onMouseMove
        )
    }

    render() {
        const { props, legend } = this
        const {
            rectHeight,
            numericLabels,
            height,
            positionedBins,
            focusBracket
        } = legend
        //Bounds.debug([this.bounds])

        const borderColor = "#333"
        const bottomY = props.y + height

        return (
            <g ref={this.base} className="numericColorLegend">
                {numericLabels.map((label, i) => (
                    <line
                        key={i}
                        x1={props.x + label.bounds.x + label.bounds.width / 2}
                        y1={bottomY - rectHeight}
                        x2={props.x + label.bounds.x + label.bounds.width / 2}
                        y2={bottomY + label.bounds.y + label.bounds.height}
                        stroke={borderColor}
                        strokeWidth={0.3}
                    />
                ))}
                {sortBy(
                    positionedBins.map((d, i) => {
                        const isFocus =
                            focusBracket && d.bin.equals(focusBracket)
                        return (
                            <rect
                                key={i}
                                x={props.x + d.x}
                                y={bottomY - rectHeight}
                                width={d.width}
                                height={rectHeight}
                                fill={d.bin.color}
                                stroke={
                                    isFocus ? FOCUS_BORDER_COLOR : borderColor
                                }
                                strokeWidth={isFocus ? 2 : 0.3}
                            />
                        )
                    }),
                    r => r.props["strokeWidth"]
                )}
                {numericLabels.map((label, i) => (
                    <text
                        key={i}
                        x={props.x + label.bounds.x}
                        y={bottomY + label.bounds.y}
                        fontSize={label.fontSize}
                        dominantBaseline="hanging"
                    >
                        {label.text}
                    </text>
                ))}
            </g>
        )
    }
}

interface CategoricalColorLegendViewProps {
    legend: MapCategoricalColorLegend
    x: number
    y: number
    onMouseOver: (d: CategoricalBin) => void
    onMouseLeave: () => void
}

@observer
class CategoricalColorLegendView extends React.Component<
    CategoricalColorLegendViewProps
> {
    render() {
        const { props } = this
        const { marks } = props.legend
        const { focusBracket } = props.legend.props

        return (
            <g className="categoricalColorLegend">
                {marks.map((m, i) => {
                    const isFocus =
                        focusBracket && m.bin.value === focusBracket.value
                    const stroke = isFocus ? FOCUS_BORDER_COLOR : "#333"
                    return (
                        <g
                            key={i}
                            onMouseOver={() => this.props.onMouseOver(m.bin)}
                            onMouseLeave={() => this.props.onMouseLeave()}
                        >
                            <rect
                                x={props.x + m.x}
                                y={props.y + m.y}
                                width={m.rectSize}
                                height={m.rectSize}
                                fill={m.bin.color}
                                stroke={stroke}
                                strokeWidth={0.4}
                            />
                            ,
                            <text
                                x={props.x + m.label.bounds.x}
                                y={props.y + m.label.bounds.y}
                                fontSize={m.label.fontSize}
                                dominantBaseline="hanging"
                            >
                                {m.label.text}
                            </text>
                        </g>
                    )
                })}
            </g>
        )
    }
}
