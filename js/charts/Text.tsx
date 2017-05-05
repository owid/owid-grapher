// @flow

import * as React from 'react'
import Bounds from './Bounds'
import striptags = require('striptags')

// Polyfill for dominant-baseline since it doesn't work in IE
export default class Text extends React.Component<any, null> {
	render() {
		const baseline = this.props['dominant-baseline']
		const bounds = Bounds.forText(striptags(this.props.children), { fontSize: this.props['font-size']||this.props['fontSize'] })
		let {x, y} = this.props

        y = y+bounds.height-bounds.height*0.2

		return <text {...this.props} y={y} dominant-baseline={null} dangerouslySetInnerHTML={{__html: this.props.children}}/>
	}
}
