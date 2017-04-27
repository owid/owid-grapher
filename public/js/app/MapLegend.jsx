// @flow

import * as _ from 'underscore'
import * as d3 from 'd3'
import owid from '../owid'
import Bounds from './Bounds'
import React, {Component} from 'react'
import {observable, computed, asFlat, action} from 'mobx'
import {observer} from 'mobx-react'
import { getRelativeMouse } from './Util'
import type {SVGElement, VNode} from './Util'
import Paragraph from './Paragraph'
import Text from './Text'
import {preInstantiate} from './Util'

@observer
class NumericMapLegend extends Component {
    @computed get numericLegendData() { return this.props.legendData.filter(l => l.type == "numeric") }
    @computed get rectHeight() { return 10 }

    // NumericMapLegend wants to map a range to a width. However, sometimes we are given
    // data without a clear min/max. So we must fit these scurrilous bins into the width somehow.
    @computed get minValue() { return _.min(this.props.legendData.map(d => d.min).filter(v => _.isFinite(v))) }
    @computed get maxValue() { return _.max(this.props.legendData.map(d => d.max).filter(v => _.isFinite(v))) }
    @computed get rangeSize() { return this.maxValue - this.minValue }
    @computed get categoryBinWidth() {
        //const meanRange = _.reduce(this.numericLegendData, (m, d) => m+(d.max-d.min), 0)/this.numericLegendData.length
        //return (meanRange/this.rangeSize) * this.props.width
        return Bounds.forText("No data", { fontSize: "0.45em" }).width
    }
    @computed get categoryBinMargin() { return this.rectHeight*1.5 }
    @computed get totalDefaultWidth() {
        return _.reduce(
            this.props.legendData.map(d => !_.isFinite(d.max-d.min) ? this.categoryBinWidth : 0),
            (m, n) => m+n
        )
    }
    @computed get availableWidth() {
        return this.props.width-this.totalDefaultWidth
    }

    @computed get positionedBins() {
        const {props, rangeSize, categoryBinWidth, categoryBinMargin, availableWidth} = this
        let xOffset = 0

        return _.map(props.legendData, d => {
            let width = categoryBinWidth, margin = categoryBinMargin
            if (_.isFinite(d.max-d.min)) {
                width = ((d.max-d.min)/rangeSize)*availableWidth
                margin = 0
            }

            const x = xOffset
            xOffset += width+margin

            return {
                x: x,
                width: width,
                marginRight: margin,
                bin: d
            }
        })
    }

    @computed get numericLabels() {
        const {width} = this.props
        const {minValue, rangeSize, rectHeight, positionedBins} = this
        const fontSize = "0.45em"

        const makeBoundaryLabel = (d, minOrMax, text) => {
            const labelBounds = Bounds.forText(text, { fontSize: fontSize })
            const x = d.x + (minOrMax == 'min' ? 0 : d.width) - labelBounds.width/2
            const y = -rectHeight-labelBounds.height-3

            return {
                text: text,
                fontSize: fontSize,
                bounds: labelBounds.extend({ x: x, y: y }),
                hidden: false
            }
        }

        const makeRangeLabel = (d) => {
            const labelBounds = Bounds.forText(d.bin.text, { fontSize: fontSize })
            const x = d.x+d.width/2 - labelBounds.width/2
            const y = -rectHeight-labelBounds.height-3

            return {
                text: d.bin.text,
                fontSize: fontSize,
                bounds: labelBounds.extend({ x: x, y: y }),
                priority: true,
                hidden: false
            }
        }

        let labels = []
        _.each(positionedBins, d => {
            if (d.bin.text)
                labels.push(makeRangeLabel(d))
            else {
                if (_.isFinite(d.bin.min)) labels.push(makeBoundaryLabel(d, 'min', d.bin.minText))
                if (_.isFinite(d.bin.max) && d == _.last(positionedBins))
                    labels.push(makeBoundaryLabel(d, 'max', d.bin.maxText))
            }
        })

        for (var i = 0; i < labels.length; i++) {
            const l1 = labels[i]
            if (l1.hidden) continue

            for (var j = i+1; j < labels.length; j++) {
                const l2 = labels[j]
                if (l1.bounds.right+5 >= l2.bounds.centerX || l2.bounds.left-5 <= l1.bounds.centerX && !l2.priority)
                    l2.hidden = true
            }
        }

        labels = labels.filter(l => !l.hidden)

        // If labels overlap, first we try alternating raised labels
        let raisedMode = false
        for (var i = 1; i < labels.length; i++) {
            const l1 = labels[i-1], l2 = labels[i]
            if (l1.bounds.right+5 >= l2.bounds.left) {
                raisedMode = true
                break
            }
        }

        if (raisedMode) {
            for (let i = 1; i < labels.length; i++) {
                let l = labels[i]
                if (i % 2 != 0) {
                    l.bounds = l.bounds.extend({ y: l.bounds.y-l.bounds.height-1 })
                }
            }
        }

        return labels
    }

    @computed get height() { return Math.abs(_.min(this.numericLabels.map(l => l.bounds.y))) }

    @action.bound onMouseMove(evt) {
        const {props, bounds, g, minValue, rangeSize} = this
        const mouse = getRelativeMouse(g, d3.event)
        if (!this.bounds.containsPoint(mouse[0], mouse[1]))
            if (props.focusBracket && (props.focusBracket.value == "No data" || props.focusBracket.type == 'numeric'))
                return this.props.onMouseLeave()
            else
                return

        let focusBracket = null
        this.positionedBins.forEach(d => {
            if (mouse[0] > props.x+d.x)
                focusBracket = d.bin
        })

        if (focusBracket)
            this.props.onMouseOver(focusBracket)
    }

    componentDidMount() {
        d3.select('html').on('mousemove.mapLegend', this.onMouseMove)
        d3.select('html').on('touchmove.mapLegend', this.onMouseMove)
//        Bounds.debug(this.numericLabels.map(l => l.bounds))
    }

    componentWillUnmount() {
        d3.select('html').on('mousemove.mapLegend', null)
        d3.select('html').on('touchmove.mapLegend', null)
    }

    @computed get width() {
        return this.props.width
    }

    @computed get bounds() {
        return new Bounds(this.props.x, this.props.y, this.width, this.height)
    }

	render() {
        const {props, rectHeight, numericLabels, height, positionedBins} = this
        //Bounds.debug([this.bounds])

        const minValue = _.first(props.legendData).min
        const maxValue = props.legendData[props.legendData.length-1].max
        const rangeSize = maxValue - minValue

        const borderSize = 0.5
        const borderColor = "#333"
        const bottomY = props.y+height

		return <g class="numericMapLegend" ref={(g) => this.g = g}>
            <defs>
                <pattern id={"diagonalHatch"} patternUnits="userSpaceOnUse" width="4" height="4">
                    <path d="M-1,1 l2,-2
                               M0,4 l4,-4
                               M3,5 l2,-2"
                            style="stroke: #fff; stroke-width:0.2" />
                </pattern>
            </defs>
            {_.map(numericLabels, label =>
                <line x1={props.x+label.bounds.x+label.bounds.width/2-0.15} y1={bottomY-rectHeight} x2={props.x+label.bounds.x+label.bounds.width/2-0.15} y2={bottomY+label.bounds.y+label.bounds.height} stroke={borderColor} strokeWidth={0.3}/>
            )}
            {_.map(positionedBins, (d, i) => {
                const isFocus = props.focusBracket && (d.bin.min == props.focusBracket.min || (d.bin.value != null && d.bin.value == props.focusBracket.value))

                return [
                    <rect x={props.x+d.x} y={bottomY-rectHeight} width={d.width} height={rectHeight} fill={d.bin.color} stroke={isFocus ? "#FFEC38" : borderColor} strokeWidth={isFocus ? 3 : 0.3}/>
                ]
            })}
            {_.map(numericLabels, label =>
                <text x={props.x+label.bounds.x} y={bottomY+label.bounds.y} fontSize={label.fontSize} dominant-baseline="hanging">{label.text}</text>
            )}
		</g>
	}
}

@observer
class CategoricalMapLegend extends Component {
    @computed get markLines() {
        const props = this.props, rectSize = 10*props.scale,
              rectPadding = 3, markPadding = 5, fontSize = (0.45*props.scale)+"em"

        const lines = []
        let line = [], xOffset = 0, yOffset = 0
        _.each(props.legendData, d => {
            const labelBounds = Bounds.forText(d.text, { fontSize: fontSize })
            const markWidth = rectSize+rectPadding+labelBounds.width+markPadding

            if (xOffset + markWidth > props.maxWidth) {
                line.totalWidth = xOffset-markPadding
                lines.push(line)
                line = []
                xOffset = 0
                yOffset += rectSize+rectPadding
            }

            const markX = xOffset, markY = yOffset

            const label = {
                text: d.text,
                bounds: labelBounds.extend({ x: markX+rectSize+rectPadding, y: markY+1.5 }),
                fontSize: fontSize
            }

            line.push({
                x: markX,
                y: markY,
                rectSize: rectSize,
                label: label,
                bin: d
            })

            xOffset += markWidth
        })

        if (line.length > 0) {
            line.totalWidth = xOffset-markPadding
            lines.push(line)
        }

        return lines
    }

    @computed get width() {
        return _.max(this.markLines.map(l => l.totalWidth))
    }

    @computed get marks() {
        const lines = this.markLines

        // Center each line
        _.each(lines, line => {
            const xShift = this.width/2-line.totalWidth/2
            _.each(line, m => {
                m.x += xShift
                m.label.bounds = m.label.bounds.extend({ x: m.label.bounds.x+xShift })
            })
        })

        return _.flatten(lines)
    }

    @computed get height() {
        return _.max(_.map(this.marks, m => m.y+m.rectSize))
    }

    @computed get bounds() {
        return new Bounds(this.props.x, this.props.y, this.width, this.height)
    }

    render() {
        const {props, marks, height} = this
        //Bounds.debug([this.bounds])
        //Bounds.debug(marks.map(m => m.label.bounds))
        return <g class="categoricalMapLegend">
            {_.map(marks, m => {
                const isFocus = props.focusBracket && m.bin.value == props.focusBracket.value
                const stroke = isFocus ? "#FFEC38" : "#333"
                return <g onMouseOver={e => this.props.onMouseOver(m.bin)} onMouseLeave={e => this.props.onMouseLeave()}>
                  <rect x={props.x+m.x} y={props.y+m.y} width={m.rectSize} height={m.rectSize} fill={m.bin.color} stroke={stroke} stroke-width={0.4}/>,
                  <text x={props.x+m.label.bounds.x} y={props.y+m.label.bounds.y} fontSize={m.label.fontSize} dominant-baseline="hanging">{m.label.text}</text>
                </g>
            })}
        </g>
    }
}

@observer
export default class MapLegend extends Component {
    @computed get numericLegendData(): Object[] {
        const l = this.props.legendData.filter(l => (l.type == "numeric" || l.value == "No data") && !l.hidden)
        return _.flatten([l[l.length-1], l.slice(0, -1)])
    }
    @computed get hasNumeric(): boolean { return this.numericLegendData.length > 1 }
    @computed get categoricalLegendData(): Object[] {
        return this.props.legendData.filter(l => l.type == "categorical" && !l.hidden)
    }
    @computed get hasCategorical(): boolean { return this.categoricalLegendData.length > 1 }

    @computed get wrapLabel(): Object {
       return Paragraph.wrap(this.props.title, this.props.bounds.width, { fontSize: "0.6em" })
    }

    @computed get focusBracket() {
        const {focusBracket, focusEntity, legendData} = this.props
        if (focusBracket) return focusBracket
        if (focusEntity) return _.find(legendData, bin => {
            if (bin.type == "categorical")
                return focusEntity.value == bin.value
            else if (bin.type == "numeric")
                return focusEntity.value >= bin.min && focusEntity.value <= bin.max
        })
    }

    @computed get categoryLegend(): CategoricalMapLegend {
        const {props, hasCategorical, hasNumeric, wrapLabel, categoricalLegendData, focusBracket} = this
        return hasCategorical && preInstantiate(<CategoricalMapLegend {...props} legendData={categoricalLegendData} focusBracket={focusBracket} scale={hasNumeric ? 1 : 1} maxWidth={props.bounds.width*0.8}/>)
    }

    @computed get categoryLegendHeight(): number {
        return this.hasCategorical ? this.categoryLegend.height : 0
    }

    @computed get numericLegend(): NumericMapLegend {
        const {props, hasNumeric, numericLegendData, wrapLabel, categoryLegendHeight, focusBracket} = this
        return hasNumeric && preInstantiate(<NumericMapLegend {...props} legendData={numericLegendData} width={props.bounds.width*0.5} focusBracket={focusBracket}/>)
    }

    @computed get numericLegendHeight(): number {
        return this.hasNumeric ? this.numericLegend.height : 0
    }

    @computed get height(): number {
        return this.wrapLabel.height+this.categoryLegendHeight+this.numericLegendHeight+10
    }

    render() {
        const {bounds, title} = this.props
        const {wrapLabel, numericLegend, categoryLegend, categoryLegendHeight, hasNumeric, hasCategorical} = this
        //Bounds.debug([new Bounds(bounds.centerX-wrapLabel.width/2, bounds.bottom-wrapLabel.height, wrapLabel.width, wrapLabel.height)])

        return <g>
            {hasNumeric && <NumericMapLegend {...numericLegend.props} x={bounds.centerX-numericLegend.width/2} y={bounds.bottom-wrapLabel.height-categoryLegendHeight-numericLegend.height-4}/>}
            {hasCategorical && <CategoricalMapLegend {...categoryLegend.props} x={bounds.centerX-categoryLegend.width/2} y={bounds.bottom-wrapLabel.height-categoryLegend.height-5}/>}
            <Paragraph x={bounds.centerX-wrapLabel.width/2} y={bounds.bottom-wrapLabel.height}>{wrapLabel}</Paragraph>
        </g>
    }
}
