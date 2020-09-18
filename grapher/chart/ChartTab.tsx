// The ChartTab renders a Header and Footer as well as any chart, including the Map chart.

import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { Bounds } from "grapher/utils/Bounds"
import { Grapher } from "grapher/core/Grapher"
import { GrapherView } from "grapher/core/GrapherView"
import { Header } from "grapher/header/Header"
import { Footer } from "grapher/footer/Footer"
import { LoadingOverlay } from "grapher/loadingIndicator/LoadingOverlay"
import { getChartComponent } from "./ChartTypeMap"
import { MapChartWithLegend } from "grapher/mapCharts/MapChartWithLegend"

@observer
export class ChartTab extends React.Component<{
    grapher: Grapher
    grapherView: GrapherView
    bounds: Bounds
}> {
    @computed private get paddedBounds() {
        return this.props.bounds.pad(15)
    }

    @computed private get header() {
        const that = this
        return new Header({
            options: this.props.grapher,
            get maxWidth() {
                return that.paddedBounds.width
            },
        })
    }

    @computed private get footer() {
        const that = this
        return new Footer({
            options: this.props.grapher,
            get maxWidth() {
                return that.paddedBounds.width
            },
        })
    }

    @computed private get isExporting() {
        return !!this.props.grapher.isExporting
    }

    @computed private get svgWidth() {
        if (this.isExporting) return this.props.bounds.width

        const { overlayPadding } = this.props.grapherView
        return (
            this.props.bounds.width - overlayPadding.left - overlayPadding.right
        )
    }

    @computed private get svgHeight() {
        if (this.isExporting) return this.props.bounds.height

        const { overlayPadding } = this.props.grapherView
        return (
            this.props.bounds.height -
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
        const options = this.props.grapher
        const type = options.type
        const innerBounds = this.innerBounds

        if (!options.isReady) return <LoadingOverlay bounds={innerBounds} />

        if (options.tab === "map")
            return (
                <MapChartWithLegend
                    containerElement={
                        this.props.grapherView.base.current ?? undefined
                    }
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
            type === "LineChart" && options.lineChartTransform.isSingleTime
                ? "DiscreteBar"
                : type

        const ChartType = getChartComponent(chartTypeName) as any // todo: add typing

        return ChartType ? (
            <ChartType bounds={bounds} options={options} />
        ) : null
    }

    @computed private get svgStyle() {
        return {
            fontFamily: "Lato, 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: this.props.grapher.baseFontSize,
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
        const { grapherView, grapher } = this.props
        const { maxWidth } = this
        return (
            <React.Fragment>
                <Header maxWidth={maxWidth} options={grapher} />
                <ControlsOverlayView grapherView={grapherView}>
                    <svg {...this.svgProps}>{this.renderChart()}</svg>
                </ControlsOverlayView>
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

@observer
class ControlsOverlayView extends React.Component<{
    grapherView: GrapherView
    children: JSX.Element
}> {
    @action.bound onDataSelect() {
        this.props.grapherView.grapher.isSelectingData = true
    }

    render() {
        const { overlayPadding } = this.props.grapherView
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
            <div style={containerStyle}>
                {this.props.children}
                <div className="ControlsOverlay" style={overlayStyle}>
                    {Object.entries(this.props.grapherView.overlays).map(
                        ([key, overlay]) => (
                            <React.Fragment key={key}>
                                {overlay.props.children}
                            </React.Fragment>
                        )
                    )}
                </div>
            </div>
        )
    }
}
