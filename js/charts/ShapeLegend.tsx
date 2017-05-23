import * as _ from 'lodash'
import * as d3 from 'd3'
import * as React from 'react'
import Paragraph from './Paragraph'
import {observable, computed, action, autorun} from 'mobx'
import {observer} from 'mobx-react'
import {preInstantiate} from './Util'

interface ShapeLegendProps {
    x?: number,
    y?: number,
    maxWidth: number,
    shapeWidth: number,
    data: { shape: VNode, text: string }[]
    onMouseOver: (color: string) => void,
    onMouseLeave: () => void
}

@observer
export default class ShapeLegend extends React.Component<ShapeLegendProps, null> {
    static defaultProps: Partial<ShapeLegendProps> = {
        x: 0,
        y: 0,
        onMouseOver: () => null,
        onClick: () => null,
        onMouseLeave: () => null
    }

    @computed get shapeSize(): number { return this.props.shapeWidth }
    @computed get fontSize(): number { return 0.5 }
    @computed get afterShapePadding(): number { return 5 }
    @computed get lineHeight(): number { return 5 }

    @computed get labelMarks() {
        const {props, fontSize, shapeSize, afterShapePadding} = this

        return _.filter(_.map(props.data, d => {
            const label = preInstantiate(<Paragraph maxWidth={props.maxWidth} fontSize={fontSize}>{d.text}</Paragraph>)
            return {
                label: label,
                shape: d.shape,
                width: shapeSize+afterShapePadding+label.width,
                height: label.height
            }
        }))
    }

    @computed get width() {
        return _.max(_.map(this.labelMarks, 'width'))
    }

    @computed get height() {
        return _.sum(_.map(this.labelMarks, 'height')) + this.lineHeight*this.labelMarks.length
    }

    render() {
        const {props, shapeSize, afterShapePadding, lineHeight} = this
        let offset = 0

        return <g class="ShapeLegend">
            {_.map(this.labelMarks, mark => {
                const isFocus = mark.color == props.focusColor

                const result = <g class="legendMark" onMouseOver={e => this.props.onMouseOver(mark.color)} onMouseLeave={e => this.props.onMouseLeave()} onClick={e => this.props.onClick(mark.color)}>
                    <rect x={props.x} y={props.y+offset} width={mark.width} height={mark.height} opacity={0}/>,
                    <g transform={`translate(${props.x}, ${props.y+offset+(mark.height/2-shapeSize/2-1)})`}>
                        {mark.shape}
                    </g>
                    <Paragraph {...mark.label.props} x={props.x+shapeSize+afterShapePadding} y={props.y+offset}/>
                </g>

                offset += mark.height+lineHeight
                return result
            })}
        </g>
    }
}