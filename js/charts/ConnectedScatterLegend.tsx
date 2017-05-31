import * as React from 'react'
import {computed} from 'mobx'
import {observer} from 'mobx-react'
import {preInstantiate} from './Util'
import Paragraph from './Paragraph'
import {Triangle} from './Marks'
import Bounds from './Bounds'

interface ConnectedScatterLegendProps {
    x?: number,
    y?: number,
    maxWidth: number,
    startYear: number,
    endYear: number
}

@observer
export default class ConnectedScatterLegend extends React.Component<ConnectedScatterLegendProps, null> {
    static defaultProps: Partial<ConnectedScatterLegendProps> = {
        x: 0,
        y: 0
    }

    @computed get fontScale(): number { return 0.5 }
    @computed get fontColor(): string { return "#333" }
    @computed get maxLabelWidth(): number { return this.props.maxWidth/3 }

    @computed get startLabel() {
        const {props, maxLabelWidth, fontScale, fontColor} = this
        return preInstantiate(<Paragraph maxWidth={maxLabelWidth} scale={fontScale} fill={fontColor}>{props.startYear.toString()}</Paragraph>)
    }

    @computed get endLabel() {
        const {props, maxLabelWidth, fontScale, fontColor} = this
        return preInstantiate(<Paragraph maxWidth={maxLabelWidth} scale={fontScale} fill={fontColor}>{props.endYear.toString()}</Paragraph>)
    }

    @computed get width() {
        return this.props.maxWidth
    }

    @computed get height() {
        return Math.max(this.startLabel.height, this.endLabel.height)
    }

    render() {
        const {props, startLabel, endLabel} = this
        let offset = 0

        const lineLeft = props.x+startLabel.width+5
        const lineRight = props.x+props.maxWidth-endLabel.width-5
        const lineY = props.y+this.height/2-0.5

        return <g className="ConnectedScatterLegend">
            <Paragraph {...startLabel.props} x={props.x} y={props.y}/>
            <Paragraph {...endLabel.props} x={props.x+props.maxWidth-endLabel.width} y={props.y}/>
            <line x1={lineLeft} y1={lineY} x2={lineRight} y2={lineY} stroke="#666" strokeWidth={1}/>
            <circle cx={lineLeft} cy={lineY} r={2} fill="#666" stroke="#ccc" strokeWidth={0.2}/>
            <Triangle cx={lineRight} cy={lineY} r={3} fill="#666" stroke="#ccc" strokeWidth={0.2} 
                      transform={`rotate(${90}, ${lineRight}, ${lineY})`}
            />
        </g>
    }
}