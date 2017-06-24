import {computed} from 'mobx'
import FontSize from './FontSize'
import {defaultTo} from './Util'
import * as _ from 'lodash'
import Bounds from './Bounds'
import * as React from 'react'

export interface TextWrapProps {
    text: string,
    maxWidth: number,
    fontSize?: FontSize
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

export default class TextWrap {
    props: TextWrapProps

    constructor(props: TextWrapProps) {
        this.props = props
    }    

    @computed get maxWidth(): number { return defaultTo(this.props.maxWidth, Infinity) }
    @computed get lineHeight(): number { return 1.1 }
    @computed get fontSize(): FontSize { return defaultTo(this.props.fontSize, 1) }
    @computed get text(): string { return this.props.text }

    @computed get lines(): WrapLine[] {
        const {text, maxWidth, lineHeight, fontSize} = this

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

	render(x: number, y: number) {
        const {props, lines, fontSize, lineHeight} = this

        if (lines.length == 0)
            return null

		return <text fontSize={fontSize+'em'} x={0} y={y+lines[0].height-lines[0].height*0.2}>
			{_.map(lines, (line, i) => {
                //if (props.raw)
                //    return <tspan x={x} dy={i == 0 ? 0 : lineHeight + 'em'} dangerouslySetInnerHTML={{__html: line.text}}/>
                //else
    				return <tspan x={x} dy={i == 0 ? 0 : lineHeight + 'em'}>{strip(line.text)}</tspan>
			})}
		</text>
	}    
}