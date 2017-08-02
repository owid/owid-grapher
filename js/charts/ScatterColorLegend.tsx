import * as React from 'react'
import * as _ from 'lodash'
import {computed} from 'mobx'
import {observer} from 'mobx-react'
import {preInstantiate} from './Util'
import TextWrap from './TextWrap'

interface ColorLegendProps {
    x?: number,
    y?: number,
    maxWidth: number,
    colors: string[],
    scale: d3.ScaleOrdinal<string, string>,
    focusColor?: string,
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
    @computed get fontSize(): number { return 0.5 }
    @computed get rectSize(): number { return 5 }
    @computed get rectPadding(): number { return 5 }
    @computed get lineHeight(): number { return 5 }
    @computed get onMouseOver(): Function { return this.props.onMouseOver || _.noop }
    @computed get onMouseLeave(): Function { return this.props.onMouseLeave || _.noop }
    @computed get onClick(): Function { return this.props.onClick || _.noop }
    @computed get x(): number { return this.props.x || 0 }
    @computed get y(): number { return this.props.y || 0 }
    @computed get focusColor(): string|null { return this.props.focusColor||null }

    @computed get labelMarks(): LabelMark[] {
        const {props, fontSize, rectSize, rectPadding} = this

        return (_.filter(_.map(props.scale.domain(), value => {            
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
        })) as LabelMark[])
    }

    @computed get width(): number {
        if (this.labelMarks.length == 0)
            return 0   
        else 
            return _(this.labelMarks).map('width').max() as number
    }

    @computed get height() {
        return _.sum(_.map(this.labelMarks, 'height')) + this.lineHeight*this.labelMarks.length
    }

    render() {
        const {focusColor, rectSize, rectPadding, lineHeight} = this
        let offset = 0

        return <g className="ColorLegend clickable" style={{cursor: 'pointer'}}>
            {_.map(this.labelMarks, mark => {
                const isFocus = mark.color == focusColor

                const result = <g className="legendMark" onMouseOver={e => this.onMouseOver(mark.color)} onMouseLeave={e => this.onMouseLeave()} onClick={e => this.onClick(mark.color)}>
                    <rect x={this.x} y={this.y+offset-lineHeight/2} width={mark.width} height={mark.height+lineHeight} fill="#fff" opacity={0}/>,
                    <rect x={this.x} y={this.y+offset+rectSize/2} width={rectSize} height={rectSize} fill={mark.color}/>,
                    {mark.label.render(this.x+rectSize+rectPadding, this.y+offset)}
                </g>

                offset += mark.height+lineHeight
                return result
            })}
        </g>
    }
}
