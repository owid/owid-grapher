import * as React from 'react'
import {noop, sum, includes, max} from './Util'
import {computed} from 'mobx'
import {observer} from 'mobx-react'
import TextWrap from './TextWrap'
import {defaultTo} from './Util'
import Bounds from './Bounds'

interface ColorLegendProps {
    x?: number,
    y?: number,
    maxWidth: number,
    colors: string[],
    scale: d3.ScaleOrdinal<string, string>,
    focusColors?: string[],
    onMouseOver?: (color: string) => void,
    onClick?: (color: string) => void,
    onMouseLeave?: () => void
}

interface LabelMark {
    label: TextWrap,
    color: string,
    width: number,
    height: number
}

@observer
export default class ScatterColorLegend extends React.Component<ColorLegendProps> {
    @computed get fontSize(): number { return 0.7 }
    @computed get rectSize(): number { return Bounds.baseFontSize/3 }
    @computed get rectPadding(): number { return 5 }
    @computed get lineHeight(): number { return 5 }
    @computed get onMouseOver(): Function { return this.props.onMouseOver || noop }
    @computed get onMouseLeave(): Function { return this.props.onMouseLeave || noop }
    @computed get onClick(): Function { return this.props.onClick || noop }
    @computed get x(): number { return this.props.x || 0 }
    @computed get y(): number { return this.props.y || 0 }
    @computed get focusColors(): string[] { return this.props.focusColors||[] }

    @computed get labelMarks(): LabelMark[] {
        const {props, fontSize, rectSize, rectPadding} = this

        return props.scale.domain().map(value => {            
            const color = props.scale(value)
            if (props.colors.indexOf(color) == -1)
                return null

            const label = new TextWrap({ maxWidth: props.maxWidth, fontSize: fontSize, text: value })
            return {
                label: label,
                color: color,
                width: rectSize+rectPadding+label.width,
                height: Math.max(label.height, rectSize)
            }
        }).filter(v => !!v) as LabelMark[]
    }

    @computed get width(): number {
        if (this.labelMarks.length == 0)
            return 0   
        else 
            return defaultTo(max(this.labelMarks.map(d => d.width)), 0)
    }

    @computed get height() {
        return sum(this.labelMarks.map(d => d.height)) + this.lineHeight*this.labelMarks.length
    }

    render() {
        const {focusColors, rectSize, rectPadding, lineHeight} = this
        let offset = 0

        return <g className="ColorLegend clickable" style={{cursor: 'pointer'}}>
            {this.labelMarks.map(mark => {
                const isFocus = includes(focusColors, mark.color)

                const result = <g className="legendMark" onMouseOver={() => this.onMouseOver(mark.color)} onMouseLeave={() => this.onMouseLeave()} onClick={() => this.onClick(mark.color)}>
                    <rect x={this.x} y={this.y+offset-lineHeight/2} width={mark.width} height={mark.height+lineHeight} fill="#fff" opacity={0}/>,
                    <rect x={this.x} y={this.y+offset+rectSize/2} width={rectSize} height={rectSize} fill={mark.color}/>,
                    {mark.label.render(this.x+rectSize+rectPadding, this.y+offset, isFocus ? { style: { fontWeight: 'bold' } } : undefined)}
                </g>

                offset += mark.height+lineHeight
                return result
            })}
        </g>
    }
}
