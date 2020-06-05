import * as React from "react"
import { sum, includes, max, defaultTo } from "./Util"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { TextWrap } from "./TextWrap"

export interface ScatterColorLegendProps {
    maxWidth: number
    fontSize: number
    colorables: {
        key: string
        label: string
        color: string
    }[]
    title?: string
}

export interface LabelMark {
    label: TextWrap
    color: string
    width: number
    height: number
}

export class VerticalColorLegend {
    props: ScatterColorLegendProps
    constructor(props: ScatterColorLegendProps) {
        this.props = props
    }

    @computed get fontSize(): number {
        return 0.7 * this.props.fontSize
    }
    @computed get rectSize(): number {
        return Math.round(this.props.fontSize / 2)
    }
    @computed get rectPadding(): number {
        return 5
    }
    @computed get lineHeight(): number {
        return 5
    }

    @computed get title(): TextWrap | undefined {
        if (this.props.title) {
            return new TextWrap({
                maxWidth: this.props.maxWidth,
                fontSize: 0.75 * this.props.fontSize,
                fontWeight: 700,
                text: this.props.title
            })
        }
        return
    }

    @computed get titleHeight(): number {
        if (this.title) {
            return this.title.height + 5
        }
        return 0
    }

    @computed get labelMarks(): LabelMark[] {
        const { props, fontSize, rectSize, rectPadding } = this

        return props.colorables
            .map(c => {
                const label = new TextWrap({
                    maxWidth: props.maxWidth,
                    fontSize: fontSize,
                    text: c.label
                })
                return {
                    label: label,
                    color: c.color,
                    width: rectSize + rectPadding + label.width,
                    height: Math.max(label.height, rectSize)
                }
            })
            .filter(v => !!v) as LabelMark[]
    }

    @computed get width(): number {
        const widths = this.labelMarks.map(d => d.width)
        if (this.title) widths.push(this.title.width)
        return defaultTo(max(widths), 0)
    }

    @computed get height() {
        return (
            this.titleHeight +
            sum(this.labelMarks.map(d => d.height)) +
            this.lineHeight * this.labelMarks.length
        )
    }
}

export interface ScatterColorLegendViewProps {
    x: number
    y: number
    legend: VerticalColorLegend
    activeColors: string[]
    focusColors?: string[]
    onMouseOver?: (color: string) => void
    onClick?: (color: string) => void
    onMouseLeave?: () => void
}

@observer
export class ScatterColorLegendView extends React.Component<
    ScatterColorLegendViewProps
> {
    render() {
        const { props } = this
        const {
            focusColors,
            activeColors,
            onMouseOver,
            onMouseLeave,
            onClick
        } = props
        const {
            title,
            titleHeight,
            labelMarks,
            rectSize,
            rectPadding,
            lineHeight
        } = props.legend

        let markOffset = titleHeight

        return (
            <>
                {title && title.render(props.x, props.y, { fontWeight: 700 })}
                <g
                    className="ScatterColorLegend clickable"
                    style={{ cursor: "pointer" }}
                >
                    {labelMarks.map((mark, index) => {
                        const isActive = includes(activeColors, mark.color)
                        const isFocus = includes(focusColors, mark.color)
                        const mouseOver = onMouseOver
                            ? () => onMouseOver(mark.color)
                            : undefined
                        const mouseLeave = onMouseLeave || undefined
                        const click = onClick
                            ? () => onClick(mark.color)
                            : undefined

                        const result = (
                            <g
                                key={index}
                                className="legendMark"
                                onMouseOver={mouseOver}
                                onMouseLeave={mouseLeave}
                                onClick={click}
                                fill={!isActive ? "#ccc" : undefined}
                            >
                                <rect
                                    x={props.x}
                                    y={props.y + markOffset - lineHeight / 2}
                                    width={mark.width}
                                    height={mark.height + lineHeight}
                                    fill="#fff"
                                    opacity={0}
                                />
                                <rect
                                    x={props.x}
                                    y={
                                        props.y +
                                        markOffset +
                                        (mark.height - rectSize) / 2
                                    }
                                    width={rectSize}
                                    height={rectSize}
                                    fill={isActive ? mark.color : undefined}
                                />
                                {mark.label.render(
                                    props.x + rectSize + rectPadding,
                                    props.y + markOffset,
                                    isFocus
                                        ? { style: { fontWeight: "bold" } }
                                        : undefined
                                )}
                            </g>
                        )

                        markOffset += mark.height + lineHeight
                        return result
                    })}
                </g>
            </>
        )
    }
}
