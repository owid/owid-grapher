// @flow

import React, {Component} from 'react'
import Bounds from './Bounds'

export default class NoData extends Component {
	props: {
		bounds: Bounds
	}

	render() {
		const {bounds} = this.props
		return <text x={bounds.x+bounds.width/2} y={bounds.y+bounds.height/2} text-anchor="middle" dominant-baseline="middle">No available data</text>
	}
}