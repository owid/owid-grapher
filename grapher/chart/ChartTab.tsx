// The ChartTab renders a Header and Footer as well as any chart, including the Map chart.
// NB: If you want to create a LineChart with a Header and Footer, probably better to do that directly and not through this class.
import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { Header } from "grapher/header/Header"
import { Footer } from "grapher/footer/Footer"
import { getChartComponent } from "./ChartTypeMap"
import { MapChart } from "grapher/mapCharts/MapChart"
import {
    BASE_FONT_SIZE,
    ChartTypeName,
    GrapherTabOption,
} from "grapher/core/GrapherConstants"
import { FooterManager } from "grapher/footer/FooterManager"
import { HeaderManager } from "grapher/header/HeaderManager"
import { MapChartManager } from "grapher/mapCharts/MapChartConstants"
import { ChartManager } from "./ChartManager"
import { LoadingIndicator } from "grapher/loadingIndicator/LoadingIndicator"
import { FacetChart } from "grapher/facetChart/FacetChart"

export interface ChartTabManager
    extends FooterManager,
        HeaderManager,
        ChartManager,
        MapChartManager {
    containerElement?: HTMLDivElement
    tabBounds?: Bounds
    isExporting?: boolean
    tab?: GrapherTabOption
    type?: ChartTypeName
    isSingleTime?: boolean // todo: remove?
    isReady?: boolean
}

@observer
export class ChartTab
    extends React.Component<{
        manager: ChartTabManager
    }>
    implements FooterManager, HeaderManager {
    @computed get fontSize() {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed get currentTitle() {
        return this.manager.currentTitle ?? ""
    }

    @computed get subtitle() {
        return this.manager.subtitle ?? ""
    }

    @computed get hideLogo() {
        return !!this.manager.hideLogo
    }

    @computed get isNativeEmbed() {
        return this.manager.isNativeEmbed
    }

    @computed get isMediaCard() {
        return this.manager.isMediaCard
    }

    @computed get logo() {
        return this.manager.logo
    }

    @computed get canonicalUrl() {
        return this.manager.canonicalUrl
    }

    @computed get sourcesLine() {
        return this.manager.sourcesLine
    }

    @computed get note() {
        return this.manager.note
    }

    @computed get hasOWIDLogo() {
        return this.manager.hasOWIDLogo
    }

    @computed get originUrlWithProtocol() {
        return this.manager.originUrlWithProtocol
    }

    @computed private get paddedBounds() {
        return this.bounds.pad(15)
    }

    @computed get maxWidth() {
        return this.paddedBounds.width
    }

    @computed private get bounds() {
        return this.manager.tabBounds ?? DEFAULT_BOUNDS
    }

    @computed private get manager() {
        return this.props.manager
    }

    @computed private get containerElement() {
        return this.manager?.containerElement
    }

    @computed private get header() {
        return new Header({ manager: this })
    }

    @computed private get footer() {
        return new Footer({ manager: this })
    }

    @computed private get isExporting() {
        return this.manager.isExporting === true
    }

    @computed private get svgWidth() {
        if (this.isExporting) return this.bounds.width

        return this.bounds.width
    }

    @computed private get svgHeight() {
        if (this.isExporting) return this.bounds.height

        return this.bounds.height - this.header.height - this.footer.height - 25
    }

    @computed private get innerBounds() {
        if (this.isExporting)
            return this.paddedBounds
                .padTop(this.header.height)
                .padBottom(this.footer.height)

        return new Bounds(0, 0, this.svgWidth, this.svgHeight).padWidth(15)
    }

    @computed private get isReady() {
        return this.manager.isReady !== false
    }

    private renderChart() {
        const { manager } = this
        const type = manager.type
        const innerBounds = this.innerBounds
        const isMapTab = manager.tab === GrapherTabOption.map

        if (!this.isReady)
            return <LoadingIndicator bounds={innerBounds} color="#333" />

        if (isMapTab)
            return (
                <MapChart
                    containerElement={this.containerElement ?? undefined}
                    bounds={innerBounds}
                    manager={manager}
                />
            )

        const bounds =
            type === ChartTypeName.SlopeChart
                ? innerBounds.padTop(20)
                : innerBounds.padTop(20).padBottom(15)

        // Switch to bar chart if a single year is selected
        const chartTypeName =
            type === ChartTypeName.LineChart && manager.isSingleTime
                ? ChartTypeName.DiscreteBar
                : type || ChartTypeName.LineChart

        const ChartType = getChartComponent(chartTypeName) as any // todo: add typing

        const facetStrategy = manager.facetStrategy
        if (facetStrategy)
            return (
                <FacetChart
                    bounds={bounds}
                    chartTypeName={chartTypeName}
                    manager={manager}
                    strategy={facetStrategy}
                />
            )

        return ChartType ? (
            <ChartType bounds={bounds} manager={manager} />
        ) : null
    }

    @computed private get svgStyle() {
        return {
            fontFamily: "Lato, 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: this.fontSize,
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
            <svg className="chartTabForSvg" {...this.svgProps}>
                {this.header.renderStatic(paddedBounds.x, paddedBounds.y)}
                {this.renderChart()}
                {this.footer.renderStatic(
                    paddedBounds.x,
                    paddedBounds.bottom - this.footer.height
                )}
            </svg>
        )
    }

    private renderWithHTMLText() {
        const containerStyle: React.CSSProperties = {
            position: "relative",
            clear: "both",
        }

        return (
            <>
                <Header manager={this} />
                <div style={containerStyle}>
                    <svg className="chartTabForInteractive" {...this.svgProps}>
                        {this.renderChart()}
                    </svg>
                </div>
                <Footer manager={this} />
            </>
        )
    }

    render() {
        return this.isExporting
            ? this.renderWithSVGText()
            : this.renderWithHTMLText()
    }
}
