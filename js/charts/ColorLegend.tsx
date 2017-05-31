import * as React from 'react'
import {computed} from 'mobx'
import {observer} from 'mobx-react'
import Paragraph from './Paragraph'
import {preInstantiate} from './Util'

interface ColorLegendProps {
    x?: number,
    y?: number,
    maxWidth: number,
    colors: string[],
    scale: d3.ScaleOrdinal<string, string>,
    focusColor?: string,
    onMouseOver: (color: string) => void,
    onClick: (color: string) => void,
    onMouseLeave: () => void
}

interface LabelMark {
    label: Paragraph,
    color: string,
    width: number,
    height: number
}

@observer
export default class ColorLegend extends React.Component<ColorLegendProps, null> {
    static defaultProps: Partial<ColorLegendProps> = {
        x: 0,
        y: 0,
        onMouseOver: () => null,
        onClick: () => null,
        onMouseLeave: () => null
    }

    @computed get fontSize(): number { return 0.5 }
    @computed get rectSize(): number { return 5 }
    @computed get rectPadding(): number { return 5 }
    @computed get lineHeight(): number { return 5 }

    @computed get labelMarks(): LabelMark[] {
        const {props, fontSize, rectSize, rectPadding} = this

        return _.filter(_.map(props.scale.domain(), value => {            
            const color = props.scale(value)
            if (props.colors.indexOf(color) == -1)
                return null

            const label = preInstantiate(<Paragraph maxWidth={props.maxWidth} fontSize={fontSize}>{value}</Paragraph>)
            return {
                label: label,
                color: color,
                width: rectSize+rectPadding+label.width,
                height: Math.max(label.height, rectSize)
            }
        }))
    }

    @computed get width(): number {
        if (this.labelMarks.length == 0)
            return 0   
        else 
            return _.max(_.map(this.labelMarks, 'width'))
    }

    @computed get height() {
        return _.sum(_.map(this.labelMarks, 'height')) + this.lineHeight*this.labelMarks.length
    }

    render() {
        const {props, rectSize, rectPadding, lineHeight} = this
        let offset = 0

        return <g class="ColorLegend clickable" style={{cursor: 'pointer'}}>
            {_.map(this.labelMarks, mark => {
                const isFocus = mark.color == props.focusColor

                const result = <g class="legendMark" onMouseOver={e => this.props.onMouseOver(mark.color)} onMouseLeave={e => this.props.onMouseLeave()} onClick={e => this.props.onClick(mark.color)}>
                    <rect x={props.x} y={props.y+offset+rectSize/2} width={mark.width} height={mark.height} opacity={0}/>,
                    <rect x={props.x} y={props.y+offset+rectSize/2} width={rectSize} height={rectSize} fill={mark.color}/>,
                    <Paragraph {...mark.label.props} x={props.x+rectSize+rectPadding} y={props.y+offset}/>
                </g>

                offset += mark.height+lineHeight
                return result
            })}
        </g>
    }
}
