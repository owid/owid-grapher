import * as _ from "lodash-es"
import * as React from "react"
import { makeIdForHumanConsumption } from "@ourworldindata/utils"
import { TextWrap } from "@ourworldindata/components"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import {
    GRAPHER_FONT_SCALE_11_2,
    BASE_FONT_SIZE,
} from "../core/GrapherConstants"
import { ColorScaleBin, NumericBin } from "../color/ColorScaleBin"
import { GRAPHER_DARK_TEXT } from "../color/ColorConstants"
import {
    LegendInteractionState,
    LegendStyleConfig,
    LegendMarkerStyle,
    LegendTextStyle,
} from "../legend/LegendItemState"

export interface VerticalColorLegendManager {
    maxLegendWidth?: number
    fontSize?: number
    categoricalLegendData: ColorScaleBin[]
    legendTitle?: string
    onLegendMouseOver?: (bin: ColorScaleBin) => void
    onLegendClick?: (bin: ColorScaleBin) => void
    onLegendMouseLeave?: () => void
    legendX?: number
    legendY?: number
    isStatic?: boolean
    getLegendBinState?: (bin: ColorScaleBin) => LegendInteractionState
    legendStyleConfig?: LegendStyleConfig
    categoricalLegendStyleConfig?: LegendStyleConfig
}

interface SizedLegendSeries {
    bin: ColorScaleBin
    textWrap: TextWrap
    width: number
    height: number
    yOffset: number
}

@observer
export class VerticalColorLegend extends React.Component<{
    manager: VerticalColorLegendManager
}> {
    constructor(props: { manager: VerticalColorLegendManager }) {
        super(props)
        makeObservable(this)
    }

    @computed get manager(): VerticalColorLegendManager {
        return this.props.manager
    }

    @computed private get maxLegendWidth(): number {
        return this.manager.maxLegendWidth ?? 100
    }

    @computed private get fontSize(): number {
        return (
            GRAPHER_FONT_SCALE_11_2 * (this.manager.fontSize ?? BASE_FONT_SIZE)
        )
    }
    @computed private get rectSize(): number {
        return Math.round(this.fontSize / 1.4)
    }

    private rectPadding = 5
    private lineHeight = 5

    @computed private get title(): TextWrap | undefined {
        if (!this.manager.legendTitle) return undefined
        return new TextWrap({
            maxWidth: this.maxLegendWidth,
            fontSize: this.fontSize,
            fontWeight: 700,
            lineHeight: 1,
            text: this.manager.legendTitle,
        })
    }

    @computed private get titleHeight(): number {
        if (!this.title) return 0
        return this.title.height + 5
    }

    @computed private get series(): SizedLegendSeries[] {
        const {
            manager,
            fontSize,
            rectSize,
            rectPadding,
            titleHeight,
            lineHeight,
        } = this

        let runningYOffset = titleHeight
        return manager.categoricalLegendData.map((bin) => {
            // Get label, inferring from minText/maxText for numeric bins if needed
            let label = bin.text
            if (
                !label &&
                bin instanceof NumericBin &&
                bin.minText &&
                bin.maxText
            ) {
                label = `${bin.minText} – ${bin.maxText}`
            }

            const textWrap = new TextWrap({
                maxWidth: this.maxLegendWidth,
                fontSize,
                lineHeight: 1,
                text: label,
            })
            const width = rectSize + rectPadding + textWrap.width
            const height = Math.max(textWrap.height, rectSize)
            const yOffset = runningYOffset

            runningYOffset += height + lineHeight

            return { bin, textWrap, width, height, yOffset }
        })
    }

    @computed get width(): number {
        const widths = this.series.map((series) => series.width)
        if (this.title) widths.push(this.title.width)
        return _.max(widths) ?? 0
    }

    @computed get height(): number {
        return (
            this.titleHeight +
            _.sum(this.series.map((series) => series.height)) +
            this.lineHeight * this.series.length
        )
    }

    @computed get legendX(): number {
        return this.manager.legendX ?? 0
    }

    @computed get legendY(): number {
        return this.manager.legendY ?? 0
    }

    @computed private get legendStyleConfig(): LegendStyleConfig | undefined {
        return (
            this.manager.categoricalLegendStyleConfig ??
            this.manager.legendStyleConfig
        )
    }

    private getBinState(bin: ColorScaleBin): LegendInteractionState {
        return (
            this.manager.getLegendBinState?.(bin) ??
            LegendInteractionState.Default
        )
    }

    private getTextStyleConfig(bin: ColorScaleBin): LegendTextStyle {
        const state = this.getBinState(bin)
        const styleConfig = this.legendStyleConfig?.text
        const defaultStyle = styleConfig?.default
        const currentStyle = styleConfig?.[state]
        return { color: GRAPHER_DARK_TEXT, ...defaultStyle, ...currentStyle }
    }

    private getMarkerStyleConfig(bin: ColorScaleBin): LegendMarkerStyle {
        const state = this.getBinState(bin)
        const styleConfig = this.legendStyleConfig?.marker
        const defaultStyle = styleConfig?.default
        const currentStyle = styleConfig?.[state]
        return { fill: bin.color, ...defaultStyle, ...currentStyle }
    }

    renderLabels(): React.ReactElement {
        const { series, rectSize, rectPadding } = this

        return (
            <g id={makeIdForHumanConsumption("labels")}>
                {series.map((series) => {
                    const style = this.getTextStyleConfig(series.bin)

                    const textX = this.legendX + rectSize + rectPadding
                    const textY = this.legendY + series.yOffset

                    return (
                        <React.Fragment key={series.textWrap.text}>
                            {series.textWrap.renderSVG(textX, textY, {
                                textProps: { fill: style.color, ...style },
                            })}
                        </React.Fragment>
                    )
                })}
            </g>
        )
    }

    renderSwatches(): React.ReactElement {
        const { series, rectSize, rectPadding } = this

        return (
            <g id={makeIdForHumanConsumption("swatches")}>
                {series.map((series) => {
                    const style = this.getMarkerStyleConfig(series.bin)

                    const textX = this.legendX + rectSize + rectPadding
                    const textY = this.legendY + series.yOffset
                    const renderedTextPosition =
                        series.textWrap.getPositionForSvgRendering(textX, textY)

                    return (
                        <rect
                            id={makeIdForHumanConsumption(series.textWrap.text)}
                            key={series.textWrap.text}
                            x={this.legendX}
                            y={renderedTextPosition[1] - rectSize}
                            width={rectSize}
                            height={rectSize}
                            style={style}
                        />
                    )
                })}
            </g>
        )
    }

    renderInteractiveElements(): React.ReactElement {
        const { series, manager, lineHeight } = this
        const { onLegendClick, onLegendMouseOver, onLegendMouseLeave } = manager
        return (
            <g>
                {series.map((series) => {
                    const label = series.textWrap.text
                    const mouseOver = onLegendMouseOver
                        ? (): void => onLegendMouseOver(series.bin)
                        : undefined
                    const mouseLeave = onLegendMouseLeave || undefined
                    const click = onLegendClick
                        ? (): void => onLegendClick(series.bin)
                        : undefined

                    const cursor = click ? "pointer" : "default"

                    return (
                        <g
                            key={label}
                            className="legendMark"
                            onMouseOver={mouseOver}
                            onMouseLeave={mouseLeave}
                            onClick={click}
                            style={{ cursor }}
                        >
                            <rect
                                x={this.legendX}
                                y={
                                    this.legendY +
                                    series.yOffset -
                                    lineHeight / 2
                                }
                                width={series.width}
                                height={series.height + lineHeight}
                                fill="#fff"
                                fillOpacity={0}
                            />
                        </g>
                    )
                })}
            </g>
        )
    }

    override render(): React.ReactElement {
        return (
            <g
                id={makeIdForHumanConsumption("vertical-color-legend")}
                className="ScatterColorLegend clickable"
            >
                {this.title &&
                    this.title.renderSVG(this.legendX, this.legendY, {
                        textProps: {
                            fontWeight: 700,
                        },
                    })}
                {this.renderLabels()}
                {this.renderSwatches()}
                {!this.manager.isStatic && this.renderInteractiveElements()}
            </g>
        )
    }
}
