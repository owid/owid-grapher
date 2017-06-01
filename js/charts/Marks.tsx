import * as React from 'react'
import {observer} from 'mobx-react'

interface TriangleProps {
    cx: number,
    cy: number,
    r: number
}

@observer
export class Triangle extends React.Component<TriangleProps, undefined> {
    render() {
        const {cx, cy, r} = this.props
        const x = cx-r, y = cy-r
        const points = [x + ',' + (y + r*2), x + r*2 / 2 + ',' + y, x + r*2 + ',' + (y + r*2)];

        return <polygon 
            points={points.join(' ')}
            {...this.props}
        />
    }
}