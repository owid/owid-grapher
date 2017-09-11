/* ExportView
 * ================
 *
 * This component is responsible for getting the chart into a nice state for phantomjs
 * to take a PNG screenshot, and serializing the SVG for export.
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2016-08-09
 */

import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as ReactDOMServer from 'react-dom/server'
import * as d3 from 'd3'
import Bounds from './Bounds'
import ChartView from './ChartView'
import {when} from 'mobx'
import ChartConfig, {ChartConfigProps} from './ChartConfig'

declare const App: any

export default class ExportView {
    static bootstrap({ jsonConfig, containerNode }: { jsonConfig: ChartConfigProps, containerNode: HTMLElement }) {
        const targetWidth = App.IDEAL_WIDTH, targetHeight = App.IDEAL_HEIGHT;
        const targetBounds = new Bounds(0, 0, targetWidth, targetHeight)
        let chartView: ChartView

        const chart = new ChartConfig(jsonConfig)

        // setTimeout is to give the urlbinder a chance to update the selection
        when(
            () => chart.data.isReady,
            () => setTimeout(() => {
                const svg = ReactDOMServer.renderToStaticMarkup(<ChartView
                    chart={chart}
                    isExport={true}
                    bounds={targetBounds}/>)

                document.querySelectorAll("link").forEach(el => (el.parentNode as Node).removeChild(el))
                document.body.innerHTML = svg
                requestAnimationFrame(() => console.log(document.body.innerHTML))
            }, 0)
        )

    }
}
