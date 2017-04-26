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
    @computed get defaultBinWidth() { return 10 }
    @computed get totalDefaultWidth() {
        return _.reduce(
            this.props.legendData.map(d => !_.isFinite(d.max-d.min) ? this.defaultBinWidth : 0),
            (m, n) => m+n
        )
    }
    @computed get availableWidth() {
        return this.props.width-this.totalDefaultWidth
    }

    @computed get positionedBins() {
        const {props, rangeSize, defaultBinWidth, availableWidth} = this
        let xOffset = 0

        return _.map(props.legendData, d => {
            let width = defaultBinWidth
            if (_.isFinite(d.max-d.min))
                width = ((d.max-d.min)/rangeSize)*availableWidth


            const x = xOffset
            xOffset += width

            return {
                x: x,
                width: width,
                bin: d
            }
        })
    }

    @computed get numericLabels() {
        const {width} = this.props
        const {minValue, rangeSize, rectHeight, positionedBins} = this
        const fontSize = "0.45em"

        const makeBoundaryLabel = (d, value, text) => {
            const labelBounds = Bounds.forText(text, { fontSize: fontSize })
            const x = d.x + d.width/2 - labelBounds.width/2
            const y = -rectHeight-labelBounds.height-10

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
            const y = -rectHeight-labelBounds.height-10

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
                if (_.isFinite(d.bin.min)) labels.push(makeBoundaryLabel(d, d.bin.min, d.bin.minText))
                if (_.isFinite(d.bin.max) && d == _.last(positionedBins))
                    labels.push(makeBoundaryLabel(d, d.bin.max, d.bin.maxText))
            }
        })

        for (var i = 0; i < labels.length; i++) {
            const l1 = labels[i]
            if (l1.hidden) continue

            for (var j = i+1; j < labels.length; j++) {
                const l2 = labels[j]
                if (l1.bounds.right+5 >= l2.bounds.centerX && !l2.priority)
                    l2.hidden = true
            }
        }

        labels = labels.filter(l => !l.hidden)

        // If labels overlap, first we try alternating raised labels
        let raisedMode = false
        for (var i = 1; i < labels.length; i++) {
            const l1 = labels[i-1], l2 = labels[i]
            if (l1.bounds.intersects(l2.bounds)) {
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

    @action.bound onMouseOver(d) {
        if (this.props.onMouseOver)
            this.props.onMouseOver(d)
    }

    @action.bound onMouseLeave() {
        if (this.props.onMouseLeave)
            this.props.onMouseLeave
    }

    @action.bound onMouseMove(evt) {
        const {props, bounds, g, minValue, rangeSize} = this
        const mouse = getRelativeMouse(g, d3.event)
        if (!this.bounds.containsPoint(mouse[0], mouse[1]))
            return this.props.onMouseLeave()

        let focusBracket = null
        this.props.legendData.forEach(d => {
            const xFrac = (d.min-minValue)/rangeSize
            if (mouse[0] > props.x+(xFrac*bounds.width))
                focusBracket = d
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

    @computed get focusBracket() {
        const {focusBracket, focusEntity, legendData} = this.props
        if (focusBracket) return focusBracket
        if (focusEntity) return _.find(legendData, l => focusEntity.value >= l.min && focusEntity.value <= l.max)
    }

    @computed get width() {
        return this.props.width
    }

    @computed get bounds() {
        return new Bounds(this.props.x, this.props.y, this.width, this.height)
    }

	render() {
        const {props, rectHeight, numericLabels, focusBracket, height, positionedBins} = this

        const minValue = _.first(props.legendData).min
        const maxValue = props.legendData[props.legendData.length-1].max
        const rangeSize = maxValue - minValue

        const borderSize = 0.5
        const borderColor = "#333"
        const bottomY = props.y+height

		return <g class="numericMapLegend" ref={(g) => this.g = g}>
            {_.map(numericLabels, label =>
                <line x1={props.x+label.bounds.x+label.bounds.width/2-0.15} y1={bottomY-rectHeight} x2={props.x+label.bounds.x+label.bounds.width/2-0.15} y2={bottomY+label.bounds.y+label.bounds.height} stroke="#666" strokeWidth={0.5}/>
            )}
            <rect x={props.x-borderSize} y={bottomY-rectHeight-5-borderSize} width={props.width+borderSize*2} height={rectHeight+borderSize*2} fill={borderColor}/>
            {_.map(positionedBins, (d, i) => {
                const isFocus = focusBracket && (d.bin.min == focusBracket.min || d.bin.text == focusBracket.text)

                return [
                    <rect x={props.x+d.x} y={bottomY-rectHeight-5} width={d.width} height={rectHeight} fill={d.bin.color} onMouseOver={e => this.onMouseOver(d)} onMouseLeave={this.onMouseLeave} stroke={isFocus && "#FFEC38"} strokeWidth={isFocus && 3}/>,
                    i < props.legendData.length-1 && <rect x={props.x+d.x-0.25} y={bottomY-rectHeight-5} width={0.5} height={rectHeight} fill={borderColor}/>
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
        const props = this.props, rectSize = 12, rectPadding = 3, markPadding = 5, fontSize = "0.5em"

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
                color: d.color,
                label: label
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
        return _.max(_.map(this.marks, m => m.y+m.rectSize+3))+8
    }

    render() {
        const {props, marks, height} = this
        //Bounds.debug([props.bounds])
        //Bounds.debug(marks.map(m => m.label.bounds))
        return <g class="categoricalMapLegend">
            {_.map(marks, m =>
                [
                  <rect x={props.x+m.x} y={props.y+m.y} width={m.rectSize} height={m.rectSize} fill={m.color} stroke="#333" stroke-width={0.5}/>,
                  <text x={props.x+m.label.bounds.x} y={props.y+m.label.bounds.y} fontSize={m.label.fontSize} dominant-baseline="hanging">{m.label.text}</text>
                ]
            )}
        </g>
    }
}

@observer
export default class MapLegend extends Component {
    @computed get numericLegendData(): Object[] {
        return this.props.legendData.filter(l => (l.type == "numeric" || l.text == "No data") && !l.hidden)
    }
    @computed get hasNumeric(): boolean { return !!this.numericLegendData.length }
    @computed get categoricalLegendData(): Object[] {
        return this.props.legendData.filter(l => l.type == "categorical" && !l.hidden)
    }
    @computed get hasCategorical(): boolean { return !!this.categoricalLegendData.length }

    @computed get wrapLabel(): Object {
       return Paragraph.wrap(this.props.title, this.props.bounds.width, { fontSize: "0.6em" })
    }

    @computed get categoryLegend(): CategoricalMapLegend {
        const {props, hasCategorical, wrapLabel, categoricalLegendData} = this
        return hasCategorical && preInstantiate(<CategoricalMapLegend {...props} legendData={categoricalLegendData} maxWidth={props.bounds.width*0.8}/>)
    }

    @computed get categoricalMapLegendHeight(): number {
        return this.hasCategorical ? this.categoryLegend.height : 0
    }

    @computed get numericLegend(): NumericMapLegend {
        const {props, hasNumeric, numericLegendData, wrapLabel, categoricalMapLegendHeight} = this
        return hasNumeric && preInstantiate(<NumericMapLegend {...props} legendData={numericLegendData} width={props.bounds.width*0.5}/>)
    }

    @computed get numericMapLegendHeight(): number {
        return this.hasNumeric ? this.numericLegend.height : 0
    }

    @computed get height(): number {
        return this.wrapLabel.height+this.categoricalMapLegendHeight+this.numericMapLegendHeight
    }

    render() {
        const {bounds, title} = this.props
        const {wrapLabel, numericLegend, categoryLegend} = this

        return <g>
            <NumericMapLegend {...numericLegend.props} x={bounds.centerX-numericLegend.width/2} y={bounds.bottom-wrapLabel.height-categoryLegend.height-numericLegend.height}/>
            <CategoricalMapLegend {...categoryLegend.props} x={bounds.centerX-categoryLegend.width/2} y={bounds.bottom-wrapLabel.height-categoryLegend.height}/>
            <Paragraph x={bounds.centerX} y={bounds.bottom-wrapLabel.height} text-anchor="middle">{wrapLabel}</Paragraph>
        </g>
    }
}
