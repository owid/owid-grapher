import { Grapher } from "charts/core/Grapher"
import React from "react"
import { computed } from "mobx"
import { Header, HeaderHTML } from "charts/chart/Header"
import { SourcesFooter, SourcesFooterHTML } from "charts/chart/Footer"
import { Bounds } from "charts/utils/Bounds"
import { ControlsOverlayView } from "charts/controls/Controls"
import { ChartView } from "charts/chart/ChartView"

interface ChartLayoutProps {
    chart: Grapher
    chartView: ChartView
    bounds: Bounds
}

export class ChartLayout {
    props: ChartLayoutProps
    constructor(props: ChartLayoutProps) {
        this.props = props
    }

    @computed get paddedBounds() {
        return this.props.bounds.pad(15)
    }

    @computed get header() {
        const that = this
        return new Header({
            get chart() {
                return that.props.chart
            },
            get maxWidth() {
                return that.paddedBounds.width
            }
        })
    }

    @computed get footer() {
        const that = this
        return new SourcesFooter({
            get chart() {
                return that.props.chart
            },
            get maxWidth() {
                return that.paddedBounds.width
            }
        })
    }

    @computed get isExporting(): boolean {
        return !!this.props.chart.isExporting
    }

    @computed get svgWidth() {
        if (this.isExporting) return this.props.bounds.width

        const { overlayPadding } = this.props.chartView.controls
        return (
            this.props.bounds.width - overlayPadding.left - overlayPadding.right
        )
    }

    @computed get svgHeight() {
        if (this.isExporting) return this.props.bounds.height

        const { overlayPadding } = this.props.chartView.controls
        return (
            this.props.bounds.height -
            this.header.height -
            this.footer.height -
            overlayPadding.top -
            overlayPadding.bottom -
            25
        )
    }

    @computed get innerBounds() {
        if (this.isExporting)
            return this.paddedBounds
                .padTop(this.header.height)
                .padBottom(this.footer.height)

        return new Bounds(0, 0, this.svgWidth, this.svgHeight).padWidth(15)
    }
}

export class ChartLayoutView extends React.Component<{
    layout: ChartLayout
    children: any
}> {
    @computed get svgStyle() {
        return {
            fontFamily: "Lato, 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: this.props.layout.props.chart.baseFontSize,
            backgroundColor: "white",
            textRendering: "optimizeLegibility",
            WebkitFontSmoothing: "antialiased"
        }
    }

    renderWithSVGText() {
        const { layout } = this.props
        const { paddedBounds } = layout

        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                version="1.1"
                style={this.svgStyle as any}
                width={layout.svgWidth}
                height={layout.svgHeight}
                viewBox={`0 0 ${layout.svgWidth} ${layout.svgHeight}`}
            >
                {layout.header.render(paddedBounds.x, paddedBounds.y)}
                {this.props.children}
                {layout.footer.render(
                    paddedBounds.x,
                    paddedBounds.bottom - layout.footer.height
                )}
            </svg>
        )
    }

    renderWithHTMLText() {
        const { layout } = this.props
        const { chart, chartView } = layout.props

        return (
            <React.Fragment>
                <HeaderHTML chart={chart} header={layout.header} />
                <ControlsOverlayView
                    chart={chart}
                    chartView={chartView}
                    controls={chartView.controls}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        version="1.1"
                        style={this.svgStyle as any}
                        width={layout.svgWidth}
                        height={layout.svgHeight}
                        viewBox={`0 0 ${layout.svgWidth} ${layout.svgHeight}`}
                    >
                        {this.props.children}
                    </svg>
                </ControlsOverlayView>
                <SourcesFooterHTML
                    chart={layout.props.chart}
                    footer={layout.footer}
                />
            </React.Fragment>
        )
    }

    render() {
        return this.props.layout.isExporting
            ? this.renderWithSVGText()
            : this.renderWithHTMLText()
    }
}
