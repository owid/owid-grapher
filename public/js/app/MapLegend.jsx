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
    @computed get bounds() {
        return this.props.bounds.padWidth(this.props.bounds.width*0.25)
    }

    @computed get numericLegendData() { return this.props.legendData.filter(l => l.type == "numeric") }
    @computed get rectHeight() { return 10 }
    @computed get minValue() { return _.first(this.props.legendData).min }
    @computed get maxValue() { return _.last(this.props.legendData).max }
    @computed get rangeSize() { return this.maxValue - this.minValue }

    @computed get numericLabels() {
        const {legendData} = this.props
        const {bounds, minValue, rangeSize, rectHeight} = this
        const fontSize = "0.45em"

        const makeBoundaryLabel = (d, value, text) => {
            const labelBounds = Bounds.forText(text, { fontSize: fontSize })
            const x = bounds.left+((value-minValue)/rangeSize)*bounds.width - labelBounds.width/2
            const y = bounds.bottom-rectHeight-labelBounds.height-10

            return {
                text: text,
                fontSize: fontSize,
                bounds: labelBounds.extend({ x: x, y: y })
            }
        }

        const makeRangeLabel = (d) => {
            const labelBounds = Bounds.forText(d.text, { fontSize: fontSize })
            const midX = d.min+(d.max-d.min)/2
            const x = bounds.left+((midX-minValue)/rangeSize)*bounds.width - labelBounds.width/2
            const y = bounds.bottom-rectHeight-labelBounds.height-10

            return {
                text: d.text,
                fontSize: fontSize,
                bounds: labelBounds.extend({ x: x, y: y }),
                priority: true
            }
        }

        let labels = []
        _.each(legendData, d => {
            if (d.text)
                labels.push(makeRangeLabel(d))
            else {
                if (_.isFinite(d.min)) labels.push(makeBoundaryLabel(d, d.min, d.minText))
                if (_.isFinite(d.max) && d == _.last(legendData))
                    labels.push(makeBoundaryLabel(d, d.max, d.maxText))
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

    @computed get height() { return this.bounds.bottom-_.min(this.numericLabels.map(l => l.bounds.y)) }

    @action.bound onMouseOver(d) {
        if (this.props.onMouseOver)
            this.props.onMouseOver(d)
    }

    @action.bound onMouseLeave() {
        if (this.props.onMouseLeave)
            this.props.onMouseLeave
    }

    @action.bound onMouseMove(evt) {
        const {bounds, g, minValue, rangeSize} = this
        const mouse = getRelativeMouse(g, d3.event)
        if (!bounds.fromBottom(this.height).containsPoint(mouse[0], mouse[1]))
            return this.props.onMouseLeave()

        let focusBracket = null
        this.props.legendData.forEach(d => {
            const xFrac = (d.min-minValue)/rangeSize
            if (mouse[0] > bounds.left+(xFrac*bounds.width))
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

	render() {
        const {legendData} = this.props
        const {bounds, rectHeight, numericLabels, focusBracket} = this

        const minValue = _.first(legendData).min
        const maxValue = legendData[legendData.length-1].max
        const rangeSize = maxValue - minValue

        const borderSize = 0.5
        const borderColor = "#333"

		return <g class="numericMapLegend" ref={(g) => this.g = g}>
            {_.map(numericLabels, label =>
                <line x1={label.bounds.x+label.bounds.width/2-0.15} y1={bounds.bottom-rectHeight} x2={label.bounds.x+label.bounds.width/2-0.15} y2={label.bounds.y+label.bounds.height} stroke="#666" strokeWidth={0.5}/>
            )}
            <rect x={bounds.left-borderSize} y={bounds.bottom-rectHeight-5-borderSize} width={bounds.width+borderSize*2} height={rectHeight+borderSize*2} fill={borderColor}/>
            {_.map(legendData, (d, i) => {
                const xFrac = (d.min-minValue)/rangeSize
                const widthFrac = (d.max-minValue)/rangeSize - xFrac
                const isFocus = focusBracket && d.min == focusBracket.min

                return [
                    <rect x={bounds.left+xFrac*bounds.width} y={bounds.bottom-rectHeight-5} width={widthFrac*bounds.width} height={rectHeight} fill={d.color} onMouseOver={e => this.onMouseOver(d)} onMouseLeave={this.onMouseLeave} stroke={isFocus && "#FFEC38"} strokeWidth={isFocus && 3}/>,
                    i < legendData.length-1 && <rect x={bounds.left+((d.max-minValue)/rangeSize)*bounds.width-0.25} y={bounds.bottom-rectHeight-5} width={0.5} height={rectHeight} fill={borderColor}/>
                ]
            })}
            {_.map(numericLabels, label =>
                <text x={label.bounds.x} y={label.bounds.y} fontSize={label.fontSize} dominant-baseline="hanging">{label.text}</text>
            )}
		</g>
	}
}

@observer
class CategoricalMapLegend extends Component {
    @computed get marks() {
        const {props} = this
        const rectSize = 12, rectPadding = 3, markPadding = 5, fontSize = "0.5em", maxWidth = props.width

        const lines = []
        let line = [], xOffset = 0, yOffset = 0
        _.each(props.legendData, d => {
            const labelBounds = Bounds.forText(d.text, { fontSize: fontSize })
            const markWidth = rectSize+rectPadding+labelBounds.width+markPadding

            if (xOffset + markWidth > maxWidth) {
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

        // Center each line
        _.each(lines, line => {
            const xShift = maxWidth/2-line.totalWidth/2
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

    @computed get width() {
        return this.props.width
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
        return this.props.legendData.filter(l => l.type == "numeric" && !l.hidden)
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
        return hasCategorical && preInstantiate(<CategoricalMapLegend {...props} legendData={categoricalLegendData} width={props.bounds.width*0.8}/>)
    }

    @computed get categoricalMapLegendHeight(): number {
        return this.hasCategorical ? this.categoryLegend.height : 0
    }

    @computed get numericLegend(): NumericMapLegend {
        const {props, hasNumeric, numericLegendData, wrapLabel, categoricalMapLegendHeight} = this
        return hasNumeric && preInstantiate(<NumericMapLegend {...props} legendData={numericLegendData} bounds={props.bounds.padBottom(wrapLabel.height+categoricalMapLegendHeight)}/>)
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
            <NumericMapLegend {...numericLegend.props}/>
            <CategoricalMapLegend {...categoryLegend.props} x={bounds.centerX-categoryLegend.width/2} y={bounds.bottom-wrapLabel.height-categoryLegend.height}/>
            <Paragraph x={bounds.centerX} y={bounds.bottom-wrapLabel.height} dominant-baseline="hanging" text-anchor="middle">{wrapLabel}</Paragraph>
        </g>
    }
}
