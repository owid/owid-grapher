/* Paragraph.jsx
 * ================
 *
 * Welcome to the joy that is manually wrapping text... since SVG lacks
 * the kind of layout features we take for granted in HTML, much wrangling
 * is necessary.
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-02-02
 */

import React, {Component} from 'react'
import {computed} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'
import _ from 'lodash'

@observer
export default class Paragraph extends Component {
	// Since it is often desirable to operate on bounding data before
	// the final rendering, wrapping can be precalced here
	static wrap(str, targetWidth, opts={}) {
		const words = str.split(' ')
		const lines = []
		const lineHeight = 1.1

		let line = []
		let lineBounds = Bounds.empty()
		_.each(words, (word, i) => {
			let nextLine = line.concat([word])
			let nextBounds = Bounds.forText(nextLine.join(' '), opts)

			if (nextBounds.width > targetWidth && line.length >= 1) {
				lines.push({ str: line.join(' '), width: lineBounds.width, height: lineBounds.height })
				line = [word]
				lineBounds = Bounds.forText(word, opts)
			} else {
				line = nextLine
				lineBounds = nextBounds
			}
		})
		if (line.length > 0)
			lines.push({ str: line.join(' '), width: lineBounds.width, height: lineBounds.height })

		let height = 0
		let width = 0
		_.each(lines, (line) => {
			height += line.height
			width = Math.max(width, line.width)
		})

		return {
			lines: lines,
			lineHeight: lineHeight,
			width: width,
			height: height,
            opts: opts,
            fontSize: opts.fontSize
		}
	}

    @computed get wrap() {
        let wrap = this.props.children
        if (!wrap.lines)
            wrap = Paragraph.wrap(this.props.children, this.props.width, this.props)
        return wrap

    }

    @computed get lines() {
        return this.wrap.lines
    }

    @computed get height() {
        return this.wrap.height
    }

	render() {
        let wrappedText = this.wrap
		return <text {...wrappedText.opts} {...this.props} y={this.props.y+wrappedText.lines[0].height-wrappedText.lines[0].height*0.2}>
			{_.map(wrappedText.lines, (line, i) => {
				return <tspan x={this.props.x} dy={i == 0 ? 0 : wrappedText.lineHeight + 'em'}>{line.str}</tspan>
			})}
		</text>
	}
}
