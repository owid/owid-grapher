import * as React from 'react'
import Bounds from './Bounds'

// The default SVG text behavior is to put the text on *top* of the specified y coordinate
// Nothing else we do works like that though, so this wraps it to use the same spatial behavior
// as other componets

interface TextProps extends React.SVGProps<SVGTextElement> {
	x: number,
	y: number,
	children: string
}

export default class Text extends React.Component<TextProps> {
	render() {
		const bounds = Bounds.forText(this.props.children, { fontSize: this.props['fontSize'], fontFamily: this.props['fontFamily'] })
        const y = this.props.y+bounds.height-bounds.height*0.2

		return <text {...this.props} y={y} dangerouslySetInnerHTML={{__html: this.props.children}}/>
	}
}
