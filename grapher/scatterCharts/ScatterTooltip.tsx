import React from "react"
import { TextWrap } from "grapher/text/TextWrap"
import { first, last, compact, uniq } from "clientUtils/Util"
import { observer } from "mobx-react"
import { ScatterTooltipProps, SeriesPoint } from "./ScatterPlotChartConstants"

@observer
export class ScatterTooltip extends React.Component<ScatterTooltipProps> {
    formatValueY(value: SeriesPoint) {
        return "Y Axis: " + this.props.yColumn.formatValueLong(value.y)
    }

    formatValueX(value: SeriesPoint) {
        let s = `X Axis: ${this.props.xColumn.formatValueLong(value.x)}`
        if (!value.time.span && value.time.y !== value.time.x)
            s += ` (data from ${this.props.xColumn.originalTimeColumn.formatValue(
                value.time.x
            )})`
        return s
    }

    render() {
        const { x, y, maxWidth, fontSize, series } = this.props
        const lineHeight = 5

        const firstValue = first(series.points)
        const lastValue = last(series.points)
        const values = compact(uniq([firstValue, lastValue]))

        const elements: Array<{ x: number; y: number; wrap: TextWrap }> = []
        let offset = 0

        const heading = {
            x: x,
            y: y + offset,
            wrap: new TextWrap({
                maxWidth: maxWidth,
                fontSize: 0.75 * fontSize,
                text: series.label,
            }),
        }
        elements.push(heading)
        offset += heading.wrap.height + lineHeight

        const { yColumn } = this.props

        values.forEach((v) => {
            const year = {
                x: x,
                y: y + offset,
                wrap: new TextWrap({
                    maxWidth: maxWidth,
                    fontSize: 0.65 * fontSize,
                    text: v.time.span
                        ? `${yColumn.table.formatTime(
                              v.time.span[0]
                          )} to ${yColumn.originalTimeColumn.formatValue(
                              v.time.span[1]
                          )}`
                        : yColumn.originalTimeColumn.formatValue(v.time.y),
                }),
            }
            offset += year.wrap.height
            const line1 = {
                x: x,
                y: y + offset,
                wrap: new TextWrap({
                    maxWidth: maxWidth,
                    fontSize: 0.55 * fontSize,
                    text: this.formatValueY(v),
                }),
            }
            offset += line1.wrap.height
            const line2 = {
                x: x,
                y: y + offset,
                wrap: new TextWrap({
                    maxWidth: maxWidth,
                    fontSize: 0.55 * fontSize,
                    text: this.formatValueX(v),
                }),
            }
            offset += line2.wrap.height + lineHeight
            elements.push(...[year, line1, line2])
        })

        return (
            <g className="scatterTooltip">
                {elements.map((el, i) =>
                    el.wrap.render(el.x, el.y, { key: i })
                )}
            </g>
        )
    }
}
