// The ChartTab renders a Header and Footer as well as any chart, including the Map chart.

import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { Grapher } from "grapher/core/Grapher"
import { Header } from "grapher/header/Header"
import { Footer } from "grapher/footer/Footer"
import { LoadingOverlay } from "grapher/loadingIndicator/LoadingOverlay"
import { getChartComponent } from "./ChartTypeMap"
import { MapChartWithLegend } from "grapher/mapCharts/MapChartWithLegend"
import { OverlayPadding } from "grapher/core/GrapherConstants"
import { ControlsOverlay } from "grapher/controls/ControlsOverlay"

export interface ChartTabOptionsProvider {
    overlayPadding?: OverlayPadding
    containerElement?: HTMLDivElement
    overlays?: { [id: string]: ControlsOverlay }
}

@observer
export class ChartTab extends React.Component<{
    grapher: Grapher
    bounds?: Bounds
    options?: ChartTabOptionsProvider
}> {
    @computed private get paddedBounds() {
        return this.bounds.pad(15)
    }

    @computed private get overlayPadding() {
        return (
            this.options?.overlayPadding ?? {
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
            }
        )
    }

    @computed private get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed private get options() {
        return this.props.options
    }

    @computed private get grapher() {
        return this.props.grapher
    }

    @computed private get containerElement() {
        return this.options?.containerElement
    }

    @computed private get overlays() {
        return this.options?.overlays || {}
    }

    @computed private get header() {
        const that = this
        return new Header({
            options: this.grapher,
            get maxWidth() {
                return that.paddedBounds.width
            },
        })
    }

    @computed private get footer() {
        const that = this
        return new Footer({
            options: this.grapher,
            get maxWidth() {
                return that.paddedBounds.width
            },
        })
    }

    @computed private get isExporting() {
        return !!this.grapher.isExporting
    }

    @computed private get svgWidth() {
        if (this.isExporting) return this.bounds.width

        const { overlayPadding } = this
        return this.bounds.width - overlayPadding.left - overlayPadding.right
    }

    @computed private get svgHeight() {
        if (this.isExporting) return this.bounds.height

        const { overlayPadding } = this
        return (
            this.bounds.height -
            this.header.height -
            this.footer.height -
            overlayPadding.top -
            overlayPadding.bottom -
            25
        )
    }

    @computed private get innerBounds() {
        if (this.isExporting)
            return this.paddedBounds
                .padTop(this.header.height)
                .padBottom(this.footer.height)

        return new Bounds(0, 0, this.svgWidth, this.svgHeight).padWidth(15)
    }

    private renderChart() {
        const options = this.grapher
        const type = options.type
        const innerBounds = this.innerBounds
        const isMapTab = options.tab === "map"

        if (!options.isReady || (isMapTab && !options.mapColumn))
            return <LoadingOverlay bounds={innerBounds} />

        if (isMapTab)
            return (
                <MapChartWithLegend
                    containerElement={this.containerElement ?? undefined}
                    bounds={innerBounds}
                    options={options}
                />
            )

        const bounds =
            type === "SlopeChart"
                ? innerBounds.padTop(20)
                : innerBounds.padTop(20).padBottom(15)

        // Switch to bar chart if a single year is selected
        const chartTypeName =
            type === "LineChart" && options.isSingleTime ? "DiscreteBar" : type

        const ChartType = getChartComponent(chartTypeName) as any // todo: add typing

        return ChartType ? (
            <ChartType bounds={bounds} options={options} />
        ) : null
    }

    @computed private get svgStyle() {
        return {
            fontFamily: "Lato, 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: this.grapher.baseFontSize,
            backgroundColor: "white",
            textRendering: "optimizeLegibility",
            WebkitFontSmoothing: "antialiased",
        }
    }

    @computed private get svgProps() {
        return {
            xmlns: "http://www.w3.org/2000/svg",
            version: "1.1",
            style: this.svgStyle as any,
            width: this.svgWidth,
            height: this.svgHeight,
            viewBox: `0 0 ${this.svgWidth} ${this.svgHeight}`,
        }
    }

    private renderWithSVGText() {
        const { paddedBounds } = this

        return (
            <svg {...this.svgProps}>
                {this.header.renderStatic(paddedBounds.x, paddedBounds.y)}
                {this.renderChart()}
                {this.footer.renderStatic(
                    paddedBounds.x,
                    paddedBounds.bottom - this.footer.height
                )}
            </svg>
        )
    }

    @computed get maxWidth() {
        return this.paddedBounds.width
    }

    private renderWithHTMLText() {
        const { maxWidth, grapher } = this
        const { overlayPadding } = this

        const containerStyle: React.CSSProperties = {
            position: "relative",
            clear: "both",
            paddingTop: `${overlayPadding.top}px`,
            paddingRight: `${overlayPadding.right}px`,
            paddingBottom: `${overlayPadding.bottom}px`,
            paddingLeft: `${overlayPadding.left}px`,
        }
        const overlayStyle: React.CSSProperties = {
            position: "absolute",
            // Overlays should be positioned relative to the same origin
            // as the <svg>
            top: `${overlayPadding.top}px`,
            left: `${overlayPadding.left}px`,
            // Create 0px element to avoid capturing events.
            // Can achieve the same with `pointer-events: none`, but then control
            // has to override `pointer-events` to capture events.
            width: "0px",
            height: "0px",
        }

        return (
            <React.Fragment>
                <Header maxWidth={maxWidth} options={grapher} />
                <div style={containerStyle}>
                    <svg {...this.svgProps}>{this.renderChart()}</svg>
                    <div className="ControlsOverlay" style={overlayStyle}>
                        {Object.entries(this.overlays).map(([key, overlay]) => (
                            <React.Fragment key={key}>
                                {overlay.props.children}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
                <Footer maxWidth={maxWidth} options={grapher} />
            </React.Fragment>
        )
    }

    render() {
        return this.isExporting
            ? this.renderWithSVGText()
            : this.renderWithHTMLText()
    }
}
