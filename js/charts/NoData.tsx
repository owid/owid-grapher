import * as React from 'react'
import Bounds from './Bounds'

export default class NoData extends React.Component<{bounds: Bounds}, undefined> {
	render() {
		const {bounds} = this.props
		return <text x={bounds.x+bounds.width/2} y={bounds.y+bounds.height/2} text-anchor="middle" dominant-baseline="middle">No available data</text>
	}
}