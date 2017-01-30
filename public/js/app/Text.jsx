import React, {Component} from 'react'
import Bounds from './Bounds'

// Polyfill for dominant-baseline since it doesn't work in IE
export default class Text extends Component {
	render() {
		const baseline = this.props['dominant-baseline']
		const bounds = Bounds.forText(this.props.children, { fontSize: this.props['font-size'] })
		let {x, y} = this.props

		if (baseline == 'middle')
			y = y + bounds.height/4
		else if (baseline == 'hanging')
			y = y + bounds.height

		return <text {...this.props} y={y} dominant-baseline={null}>{this.props.children}</text>
	}
}