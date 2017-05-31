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

import * as React from 'react'
import {computed} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'
import * as _ from 'lodash'

export interface ParagraphProps {
    width?: number,
    maxWidth?: number,
    lineHeight?: number,
    fontSize?: number, // DEPRECATED
    scale?: number,
    x?: number,
    y?: number,
    style?: Object,
    children?: string,
    precalc?: Paragraph,
    raw?: boolean
}

interface WrapLine {
    text: string,
    width: number,
    height: number
}

function strip(html: string)
{
   return html.replace(/<\/?[^>]+>/g, "");
}

@observer
export default class Paragraph extends React.Component<ParagraphProps, undefined> {
    @computed get maxWidth(): number {
        return this.props.width || this.props.maxWidth
    }

    @computed get lineHeight(): number {
        return this.props.lineHeight || 1.1
    }

    @computed get fontSize(): number {
        return this.props.scale || this.props.fontSize || 1
    }

    @computed get text(): string {
        return this.props.children ? ""+this.props.children : ""
    }

    @computed get lines(): WrapLine[] {
        if (this.props.precalc)
            return this.props.precalc.lines

        const {props, text, maxWidth, lineHeight, fontSize} = this

        const words = _.isEmpty(text) ? [] : text.split(' ')
        const lines: WrapLine[] = []

        let line: string[] = []
        let lineBounds = Bounds.empty()

        _.each(words, (word, i) => {
            let nextLine = line.concat([word])
            let nextBounds = Bounds.forText(strip(nextLine.join(' ')), {fontSize: fontSize+'em'})

            const newlines = (word.match(/\n/g)||[]).length

            if (nextBounds.width > maxWidth && line.length >= 1) {
                lines.push({ text: line.join(' '), width: lineBounds.width, height: lineBounds.height })
                line = [word]
                lineBounds = Bounds.forText(strip(word), {fontSize: fontSize+'em'})
            } else {
                line = nextLine
                lineBounds = nextBounds
            }

            for (var i = 0; i < newlines; i++) {
                lines.push({ text: "", width: 0, height: lineHeight })
            }
        })
        if (line.length > 0)
            lines.push({ text: line.join(' '), width: lineBounds.width, height: lineBounds.height })

        return lines
    }


    @computed get height(): number {
        return _.reduce(this.lines, (total, line) => total+line.height, 0) + this.lineHeight*(this.lines.length-1)
    }

    @computed get width(): number {
        return _.max(this.lines.map(l => l.width))
    }

	render() {
        const {props, lines, fontSize, lineHeight} = this

        if (lines.length == 0)
            return null

		return <text {...(props as any)} fontSize={fontSize+'em'} x={0} y={props.y+lines[0].height-lines[0].height*0.2}>
			{_.map(lines, (line, i) => {
                if (props.raw)
                    return <tspan x={props.x} dy={i == 0 ? 0 : lineHeight + 'em'} dangerouslySetInnerHTML={{__html: line.text}}/>
                else
    				return <tspan x={props.x} dy={i == 0 ? 0 : lineHeight + 'em'}>{strip(line.text)}</tspan>
			})}
		</text>
	}
}
''