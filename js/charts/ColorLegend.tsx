/* ColorLegend.tsx
 * ================
 *
 * Pure component responsible for basic rendering of color=>text legend.
 *
 */

import * as React from 'react'
import * as _ from 'lodash'
import {preInstantiate, defaultTo} from './Util'
import {computed} from 'mobx'
import {observer} from 'mobx-react'
import TextWrap from './TextWrap'

export interface ColorLegendProps {
    items: ColorLegendItem[],
    x: (legend: ColorLegend) => number
    y: (legend: ColorLegend) => number,
    bounding?: (legend: ColorLegend) => React.ReactNode
    maxWidth?: number,
    onMouseOver?: (color: string) => void,
    onClick?: (color: string) => void,
    onMouseLeave?: () => void
}

export interface ColorLegendItem {
    label: string,
    color: string
}

interface ColorLegendMark {
    textWrap: TextWrap,
    color: string,
    width: number,
    height: number
}

export default class ColorLegend {
    props: ColorLegendProps

    @computed get fontSize(): number { return 0.8 }
    @computed get rectSize(): number { return 10 }
    @computed get rectPadding(): number { return 5 }
    @computed get lineHeight(): number { return 5 }
    @computed get bounding() { return defaultTo(this.props.bounding, _.noop) }
    @computed get maxWidth() { return defaultTo(this.props.maxWidth, Infinity) }
    @computed get onMouseOver(): Function { return defaultTo(this.props.onMouseOver, _.noop) }
    @computed get onMouseLeave(): Function { return defaultTo(this.props.onMouseLeave, _.noop) }
    @computed get onClick(): Function { return defaultTo(this.props.onClick, _.noop) }

    @computed get marks(): ColorLegendMark[] {
        const {fontSize, rectSize, rectPadding, maxWidth} = this
        const maxTextWidth = maxWidth-rectSize-rectPadding

        return this.props.items.map(item => {
            const textWrap = new TextWrap({ text: item.label, maxWidth: maxTextWidth, fontSize: fontSize })
            return {
                textWrap: textWrap,
                color: item.color,
                width: rectSize+rectPadding+textWrap.width,
                height: Math.max(textWrap.height, rectSize)
            }
        })
    }

    @computed get width(): number {
        if (this.marks.length == 0)
            return 0
        else 
            return _(this.marks).map('width').max()
    }

    @computed get height() {
        return _(this.marks).map('height').sum() + this.lineHeight*this.marks.length
    }
}

@observer
export class ColorLegendView extends React.Component<{ x: number, y: number, legend: ColorLegend }, undefined> {
    render() {
        const {x, y, legend} = this.props
        const {rectSize, rectPadding, lineHeight} = legend

        let offset = 0
        return <g className="ColorLegend">
            <g className="clickable" style={{cursor: 'pointer'}}>
                {legend.marks.map(mark => {
                    const result = <g className="legendMark" onMouseOver={e => this.onMouseOver(mark.color)} onMouseLeave={e => this.onMouseLeave()} onClick={e => this.onClick(mark.color)}>
                        <rect x={x} y={y+offset-lineHeight/2} width={mark.width} height={mark.height+lineHeight} fill="#fff" opacity={0}/>,
                        <rect x={x} y={y+offset+rectSize/2} width={rectSize} height={rectSize} fill={mark.color}/>,
                        <Paragraph {...mark.label.props} x={x+rectSize+rectPadding} y={y+offset}/>
                    </g>

                    offset += mark.height+lineHeight
                    return result
                })}
            </g>
        </g>
    }
}
