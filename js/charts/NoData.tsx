import * as React from 'react'
import Bounds from './Bounds'

export default class NoData extends React.Component<{bounds: Bounds, message?: string}> {
	render() {
		const {bounds, message} = this.props
		return <text x={bounds.x+bounds.width/2} y={bounds.y+bounds.height/2} text-anchor="middle" dominant-baseline="middle">{message || "No available data"}</text>
	}
}