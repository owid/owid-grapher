/*

WIP: eventual interface for split visualization library

Interface should be like...

const chart = new Chart({ config: foo, data: etc })
chart.interactive(domNode)

*/

import * as React from "react"
import * as ReactDOM from "react-dom"

import { Bounds } from "./Bounds"
import { ChartConfig } from "./ChartConfig"
import { ChartView } from "./ChartView"

interface ChartConfigProps {
    type: string
}

export class Chart {
    static testBootstrap() {
        const figure = document.getElementsByTagName("figure")[0]
        const chart = new Chart({ type: "LineChart" })
        chart.interactive(figure)
    }

    config: ChartConfig
    constructor(props: ChartConfigProps) {
        this.config = new ChartConfig(props as any)
    }

    interactive(containerNode: HTMLElement) {
        const containerBounds = new Bounds(0, 0, 800, 600)
        ReactDOM.render(
            <ChartView
                bounds={containerBounds}
                chart={this.config}
                isEditor={false}
                isEmbed={false}
            />,
            containerNode
        )
    }
}
