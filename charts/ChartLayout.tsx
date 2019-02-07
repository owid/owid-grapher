import { ChartConfig } from "./ChartConfig"
import React = require("react")
import { computed } from "mobx"
import { Header } from "./Header"
import { SourcesFooter } from "./SourcesFooter"
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

    render() {
    }
}

export class ChartLayoutView extends React.Component<{ layout: ChartLayout, children: any }> {
    render() {
        const { layout } = this.props
        const { bounds } = layout

        const svgStyle = {
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: layout.props.chart.baseFontSize,
            backgroundColor: "white",
            textRendering: "optimizeLegibility",
            WebkitFontSmoothing: "antialiased"
        }        

        return <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style={svgStyle as any} width={layout.props.bounds.width} height={layout.props.bounds.height}>
            {layout.header.render(bounds.x, bounds.y)}
            {this.props.children}
            {layout.footer.render(bounds.x, bounds.bottom-layout.footer.height)}
        </svg>
    }
}