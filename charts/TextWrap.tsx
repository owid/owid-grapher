import { isEmpty, reduce, map, max } from './Util'
import { computed } from 'mobx'
import { FontSize } from './FontSize'
import { defaultTo } from './Util'
import { Bounds } from './Bounds'
import * as React from 'react'

export interface TextWrapProps {
    text: string,
    maxWidth: number,
    lineHeight?: number,
    fontSize: FontSize,
    raw?: true
}

interface WrapLine {
    text: string,
    width: number,
    height: number
}

function strip(html: string) {
    return html.replace(/<\/?[^>]+>/g, "")
}

export class TextWrap {
    props: TextWrapProps
    constructor(props: TextWrapProps) {
        this.props = props
    }

    @computed get maxWidth(): number { return defaultTo(this.props.maxWidth, Infinity) }
    @computed get lineHeight(): number { return defaultTo(this.props.lineHeight, 1.1) }
    @computed get fontSize(): FontSize { return defaultTo(this.props.fontSize, 1) }
    @computed get text(): string { return this.props.text }

    @computed get lines(): WrapLine[] {
        const { text, maxWidth, fontSize } = this

        const words = isEmpty(text) ? [] : text.split(' ')
        const lines: WrapLine[] = []

        let line: string[] = []
        let lineBounds = Bounds.empty()

        words.forEach(word => {
            const nextLine = line.concat([word])
            const nextBounds = Bounds.forText(strip(nextLine.join(' ')), { fontSize: fontSize })

            if (nextBounds.width+10 > maxWidth && line.length >= 1) {
                lines.push({ text: line.join(' '), width: lineBounds.width, height: lineBounds.height })
                line = [word]
                lineBounds = Bounds.forText(strip(word), { fontSize: fontSize })
            } else {
                line = nextLine
                lineBounds = nextBounds
            }
        })
        if (line.length > 0)
            lines.push({ text: line.join(' '), width: lineBounds.width, height: lineBounds.height })

        return lines
    }

    @computed get height(): number {
        return reduce(this.lines, (total, line) => total + line.height, 0) + this.lineHeight * (this.lines.length - 1)
    }

    @computed get width(): number {
        return defaultTo(max(this.lines.map(l => l.width)), 0)
    }

    @computed get htmlStyle(): any {
        const { fontSize, lineHeight } = this
        return {fontSize: fontSize.toFixed(2)+'px', lineHeight: lineHeight, overflowY: 'visible'}
    }

    renderHTML() {
        const { props, lines } = this

        if (lines.length === 0)
            return null

        // if (props.raw)
        //     return <p style={{ fontSize: fontSize.toFixed(2) + "px", lineHeight: lineHeight, width: this.width }} {...options} dangerouslySetInnerHTML={{__html: text}}/>
        // else
        //     return <p style={{ fontSize: fontSize.toFixed(2) + "px", lineHeight: lineHeight, width: this.width }} {...options}>{strip(text)}</p>

        return <React.Fragment>
            {lines.map((line, i) => {
                if (props.raw)
                    return <React.Fragment key={i}>
                        <span dangerouslySetInnerHTML={{ __html: line.text }} /><br/>
                    </React.Fragment>
                else
                    return <React.Fragment key={i}>
                        {strip(line.text)}<br/>
                    </React.Fragment>
            })}
        </React.Fragment>
    }

    render(x: number, y: number, options?: any) {//React.SVGAttributes<SVGTextElement>) {
        const { props, lines, fontSize, lineHeight } = this

        if (lines.length === 0)
            return null

        const yOffset = y + lines[0].height - lines[0].height * 0.2
        return <text fontSize={fontSize.toFixed(2)} x={x.toFixed(1)} y={yOffset.toFixed(1)} {...options}>
            {lines.map((line, i) => {
                if (props.raw)
                    return <tspan key={i} x={x} y={yOffset + (i === 0 ? 0 : lineHeight * fontSize * i)} dangerouslySetInnerHTML={{ __html: line.text }} />
                else
                    return <tspan key={i} x={x} y={yOffset + (i === 0 ? 0 : lineHeight * fontSize * i)}>{strip(line.text)}</tspan>
            })}
        </text>
    }
}
