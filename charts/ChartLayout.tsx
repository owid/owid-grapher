import { ChartConfig } from "./ChartConfig"
import React = require("react")
import { computed } from "mobx"
import { Header, HeaderHTML } from "./Header"
import { SourcesFooter, SourcesFooterHTML } from "./SourcesFooter"
import { Bounds } from "./Bounds"


export interface ChartLayoutProps {
    chart: ChartConfig
    bounds: Bounds
}

export class ChartLayout {
    props: ChartLayoutProps
    constructor(props: ChartLayoutProps) {
        this.props = props
    }

    @computed get bounds() {
        return this.props.bounds.pad(15)
    }

    @computed get header() {
        const that = this

        return new Header({
            get chart() { return that.props.chart },
            get maxWidth() { return that.bounds.width }
        })
    }

    @computed get footer() {
        const that = this
        return new SourcesFooter({
            get chart() { return that.props.chart },
            get maxWidth() { return that.bounds.width }
        })
    }

    @computed get innerBounds() {
        return this.bounds.padTop(this.header.height).padBottom(this.footer.height)
    }
}

export class ChartLayoutView extends React.Component<{ layout: ChartLayout, children: any }> {
    @computed get svgStyle() {
        return {
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: this.props.layout.props.chart.baseFontSize,
            backgroundColor: "white",
            textRendering: "optimizeLegibility",
            WebkitFontSmoothing: "antialiased"
        }        
    }

    renderWithSVGText() {
        const { layout } = this.props
        const { bounds } = layout

        return <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style={this.svgStyle as any} width={layout.props.bounds.width} height={layout.props.bounds.height}>
            {layout.header.render(bounds.x, bounds.y)}
            {this.props.children}
            {layout.footer.render(bounds.x, bounds.bottom-layout.footer.height)}
        </svg>
    }

    renderWithHTMLText() {
        const { layout } = this.props
        const { bounds } = layout

        return <div>
            <HeaderHTML chart={layout.props.chart} header={layout.header}/>
            <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style={this.svgStyle as any} width={layout.props.bounds.width} height={layout.props.bounds.height}>
                {this.props.children}
                {layout.footer.render(bounds.x, bounds.bottom-layout.footer.height)}
            </svg>
            <SourcesFooterHTML chart={layout.props.chart}/>
        </div> 
    }

    render() {
        const isHtml = true
        return isHtml ? this.renderWithHTMLText() : this.renderWithSVGText()
    }
}