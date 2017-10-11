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
import * as ReactDOMServer from 'react-dom/server'
import Bounds from './Bounds'
import ChartView from './ChartView'
import { when } from 'mobx'
import ChartConfig, { ChartConfigProps } from './ChartConfig'

export default class ExportView {
    static bootstrap({ jsonConfig }: { jsonConfig: ChartConfigProps }) {
        const targetWidth = 1020, targetHeight = 720
        const targetBounds = new Bounds(0, 0, targetWidth, targetHeight)

        const chart = new ChartConfig(jsonConfig)

        // setTimeout is to give the urlbinder a chance to update the selection
        when(
            () => chart.data.isReady,
            () => setTimeout(() => {
                chart.baseFontSize = 18
                Bounds.baseFontFamily = "Helvetica, Arial"

                const svg = ReactDOMServer.renderToStaticMarkup(<ChartView
                    chart={chart}
                    isExport={true}
                    bounds={targetBounds} />)

                Array.from(document.querySelectorAll("link")).forEach(el => (el.parentNode as Node).removeChild(el))
                document.body.innerHTML = svg
                // tslint:disable-next-line:no-console
                requestAnimationFrame(() => console.log(document.body.innerHTML))
            }, 0)
        )

    }
}
