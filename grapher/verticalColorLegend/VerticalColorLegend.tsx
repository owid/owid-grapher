import * as React from "react"
import { sum, max } from "grapher/utils/Util"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { TextWrap } from "grapher/text/TextWrap"
import { ColorScaleBin } from "grapher/color/ColorScaleBin"
import { BASE_FONT_SIZE, Color } from "grapher/core/GrapherConstants"

export interface VerticalColorLegendManager {
    maxLegendWidth?: number
    fontSize?: number
    colorBins: ColorScaleBin[]
    title?: string
    onLegendMouseOver?: (color: string) => void
    onLegendClick?: (color: string) => void
    onLegendMouseLeave?: () => void
    legendX?: number
    legendY?: number
    activeColors: Color[]
    focusColors?: Color[]
}

interface LabelMark {
    label: TextWrap
    color: Color
    width: number
    height: number
}

@observer
export class VerticalColorLegend extends React.Component<{
    manager: VerticalColorLegendManager
}> {
    @computed get manager() {
        return this.props.manager
    }

    @computed private get maxLegendWidth() {
        return this.manager.maxLegendWidth ?? 100
    }

    @computed private get fontSize() {
        return 0.7 * (this.manager.fontSize ?? BASE_FONT_SIZE)
    }
    @computed private get rectSize() {
        return Math.round(this.fontSize / 2)
    }

    private rectPadding = 5
    private lineHeight = 5

    @computed private get title() {
        if (!this.manager.title) return undefined
        return new TextWrap({
            maxWidth: this.maxLegendWidth,
            fontSize: 0.75 * this.fontSize,
            fontWeight: 700,
            text: this.manager.title,
        })
    }

    @computed private get titleHeight() {
        if (!this.title) return 0
        return this.title.height + 5
    }

    @computed private get labelMarks() {
        const { manager, fontSize, rectSize, rectPadding } = this

        return manager.colorBins
            .map((bin) => {
                const label = new TextWrap({
                    maxWidth: this.maxLegendWidth,
                    fontSize,
                    text: bin.label || "",
                })
                return {
                    label,
                    color: bin.color,
                    width: rectSize + rectPadding + label.width,
                    height: Math.max(label.height, rectSize),
                }
            })
            .filter((v) => !!v) as LabelMark[]
    }

    @computed get width() {
        const widths = this.labelMarks.map((d) => d.width)
        if (this.title) widths.push(this.title.width)
        return max(widths) ?? 0
    }

    @computed get height() {
        return (
            this.titleHeight +
            sum(this.labelMarks.map((d) => d.height)) +
            this.lineHeight * this.labelMarks.length
        )
    }

    render() {
        const {
            title,
            titleHeight,
            labelMarks,
            rectSize,
            rectPadding,
            lineHeight,
            manager,
        } = this
        const {
            focusColors,
            activeColors,
            onLegendMouseOver,
            onLegendMouseLeave,
            onLegendClick,
        } = manager

        const x = manager.legendX ?? 0
        const y = manager.legendY ?? 0

        let markOffset = titleHeight

        return (
            <>
                {title && title.render(x, y, { fontWeight: 700 })}
                <g
                    className="ScatterColorLegend clickable"
                    style={{ cursor: "pointer" }}
                >
                    {labelMarks.map((mark, index) => {
                        const isActive = activeColors.includes(mark.color)
                        const isFocus =
                            focusColors?.includes(mark.color) ?? false
                        const mouseOver = onLegendMouseOver
                            ? () => onLegendMouseOver(mark.color)
                            : undefined
                        const mouseLeave = onLegendMouseLeave || undefined
                        const click = onLegendClick
                            ? () => onLegendClick(mark.color)
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
                                    x={x}
                                    y={y + markOffset - lineHeight / 2}
                                    width={mark.width}
                                    height={mark.height + lineHeight}
                                    fill="#fff"
                                    opacity={0}
                                />
                                <rect
                                    x={x}
                                    y={
                                        y +
                                        markOffset +
                                        (mark.height - rectSize) / 2
                                    }
                                    width={rectSize}
                                    height={rectSize}
                                    fill={isActive ? mark.color : undefined}
                                />
                                {mark.label.render(
                                    x + rectSize + rectPadding,
                                    y + markOffset,
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
