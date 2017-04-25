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
import {cacheChild} from './Util'

@observer
class NumericMapLegend extends Component {
    @computed get bounds() {
        return this.props.bounds.padWidth(this.props.bounds.width*0.25)
    }

    @computed get wrapLabel() {
        return Paragraph.wrap(this.props.title, this.width, { fontSize: "0.6em" })
    }

    @computed get numericLegendData() { return this.props.legendData.filter(l => l.type == "numeric") }
    @computed get rectHeight() { return 10 }
    @computed get minValue() { return _.first(this.props.legendData).min }
    @computed get maxValue() { return this.props.legendData[this.props.legendData.length-2].max }
    @computed get rangeSize() { return this.maxValue - this.minValue }

    @computed get numericLabels() {
        const {legendData} = this.props
        const {bounds, minValue, rangeSize, rectHeight, wrapLabel} = this
        const fontSize = "0.45em"

        const makeBoundaryLabel = (d, value, text) => {
            const labelBounds = Bounds.forText(text, { fontSize: fontSize })
            const x = bounds.left+((value-minValue)/rangeSize)*bounds.width - labelBounds.width/2
            const y = bounds.bottom-rectHeight-wrapLabel.height-labelBounds.height-10

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
            const y = bounds.bottom-rectHeight-wrapLabel.height-labelBounds.height-10

            return {
                text: d.text,
                fontSize: fontSize,
                bounds: labelBounds.extend({ x: x, y: y }),
                priority: true
            }
        }

        let labels = []
        _.each(legendData.slice(0, -1), d => {
            if (d.text)
                labels.push(makeRangeLabel(d))
            else {
                if (_.isFinite(d.min)) labels.push(makeBoundaryLabel(d, d.min, d.minText))
                if (_.isFinite(d.max) && d == legendData[legendData.length-2])
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

    componentWillMount() {
        if (this.props.instance)
            return this.props.instance.componentWillMount()
    }

    componentDidMount() {
        if (this.props.instance)
            return this.props.instance.componentDidMount()

        d3.select('html').on('mousemove.mapLegend', this.onMouseMove)
        d3.select('html').on('touchmove.mapLegend', this.onMouseMove)
//        Bounds.debug(this.numericLabels.map(l => l.bounds))
    }

    componentWillUnmount() {
        if (this.props.instance)
            return this.props.instance.componentWillUnmount()

        d3.select('html').on('mousemove.mapLegend', null)
        d3.select('html').on('touchmove.mapLegend', null)
    }

    @computed get focusBracket() {
        const {focusBracket, focusEntity, legendData} = this.props
        if (focusBracket) return focusBracket
        if (focusEntity) return _.find(legendData, l => focusEntity.value >= l.min && focusEntity.value <= l.max)
    }

	render() {
        if (this.props.instance)
            return this.props.instance.render()

        const {legendData} = this.props
        const {bounds, wrapLabel, rectHeight, numericLabels, focusBracket} = this

        const minValue = _.first(legendData).min
        const maxValue = legendData[legendData.length-2].max
        const rangeSize = maxValue - minValue

        const borderSize = 0.5
        const borderColor = "#333"

		return <g class="mapLegend" ref={(g) => this.g = g}>
            {_.map(numericLabels, label =>
                <line x1={label.bounds.x+label.bounds.width/2-0.15} y1={bounds.bottom-rectHeight-wrapLabel.height} x2={label.bounds.x+label.bounds.width/2-0.15} y2={label.bounds.y+label.bounds.height} stroke="#666" strokeWidth={0.5}/>
            )}
            <rect x={bounds.left-borderSize} y={bounds.bottom-rectHeight-wrapLabel.height-5-borderSize} width={bounds.width+borderSize*2} height={rectHeight+borderSize*2} fill={borderColor}/>
            {_.map(legendData.slice(0, -1), (d, i) => {
                const xFrac = (d.min-minValue)/rangeSize
                const widthFrac = (d.max-minValue)/rangeSize - xFrac
                const isFocus = focusBracket && d.min == focusBracket.min

                return [
                    <rect x={bounds.left+xFrac*bounds.width} y={bounds.bottom-rectHeight-wrapLabel.height-5} width={widthFrac*bounds.width} height={rectHeight} fill={d.color} onMouseOver={e => this.onMouseOver(d)} onMouseLeave={this.onMouseLeave} stroke={isFocus && "#FFEC38"} strokeWidth={isFocus && 3}/>,
                    i < legendData.length-2 && <rect x={bounds.left+((d.max-minValue)/rangeSize)*bounds.width-0.25} y={bounds.bottom-rectHeight-wrapLabel.height-5} width={0.5} height={rectHeight} fill={borderColor}/>
                ]
            })}
            {_.map(numericLabels, label =>
                <text x={label.bounds.x} y={label.bounds.y} fontSize={label.fontSize} dominant-baseline="hanging">{label.text}</text>
            )}
            <Paragraph x={bounds.centerX} y={bounds.bottom-wrapLabel.height} dominant-baseline="hanging" text-anchor="middle">{wrapLabel}</Paragraph>
		</g>
	}
}

@observer
export default class MapLegend extends Component {
    @computed get hasNumeric(): boolean { return !!this.props.legendData.filter(l => l.type == "numeric").length }
    @computed get hasCategorical(): boolean { return !!this.props.legendData.filter(l => l.type == "categorical").length }

    get numericMapLegend(): VNode {
        return cacheChild(this, 'numericMapLegend',
            this.hasNumeric && <NumericMapLegend bounds={this.props.bounds} {...this.props}/>)
    }

    @computed get height(): number {
        return this.numericMapLegend.height
    }

    render() {
        if (this.props.instance)
            return this.props.instance.render()

        const {numericMapLegend} = this
        return <NumericMapLegend instance={numericMapLegend} {...numericMapLegend.props}/>
    }
}
