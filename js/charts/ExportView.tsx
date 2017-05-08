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

import * as _ from 'lodash'
import * as $ from 'jquery'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import Bounds from './Bounds'
import {svgAsDataUri} from './saveSvgAsPng'
import ChartView from './ChartView'

const callPhantom = window.callPhantom || console.log

function prepareSVGForExport(chartView, svg) {
    // Inline the CSS styles, since the exported SVG won't have a stylesheet
    var styleSheets = document.styleSheets;
    var elems = [];
    _.each(document.styleSheets, function(styleSheet) {
        _.each(styleSheet.cssRules, function(rule) {
            try {
                $(rule.selectorText).each(function(i, elem) {
                    if (!elem.origStyle && !elem.hasChangedStyle) {
                        elem.origStyle = elem.style.cssText;
                        elem.style.cssText = "";
                        elems.push(elem);
                    }

                    if ($(elem).parent().closest("svg").length) {
                        elem.style.cssText += rule.style.cssText;
                        elem.hasChangedStyle = true;
                    }
                });
            } catch (e) {}
        });
    });

    _.each(elems, function(elem) {
        if (elem.origStyle)
            elem.style.cssText += elem.origStyle;
    });

    const chartEl = d3.select(chartView.base)

    // MISPY: Need to propagate a few additional styles from the external document into the SVG
    svg.style("font-family", chartEl.style("font-family"));
    svg.style("width", chartEl.style("width"));
    svg.style("height", chartEl.style("height"));
    svg.style("font-size", chartEl.style("font-size"));
    svg.style("background-color", "#fff")

    // Remove all other styles for easier testing that this works
    //d3.selectAll('link').remove()

    svgAsDataUri(svg.node(), {}, function(uri) {
        var svgData = uri.substring('data:image/svg+xml;base64,'.length);
        callPhantom({ "svg": svgData });
    });
}

export default class ExportView {
    static bootstrap({ jsonConfig, containerNode }) {
        const targetWidth = App.IDEAL_WIDTH, targetHeight = App.IDEAL_HEIGHT;
        const targetBounds = new Bounds(0, 0, targetWidth, targetHeight)
        let chartView = null

        const onRenderEnd = function() {
            const svg = d3.select(chartView.svgNode)
            svg.selectAll(".nv-add-btn, .nv-controlsWrap").remove();

            callPhantom({ targetWidth: targetWidth, targetHeight: targetHeight }); // Notify phantom that we're ready for PNG screenshot
            prepareSVGForExport(chartView, svg);
        }

        ReactDOM.render(<ChartView
            isExport={true}
            bounds={targetBounds}
            jsonConfig={jsonConfig}
            onRenderEnd={onRenderEnd}
            ref={e => chartView = e}/>, containerNode)
    }
}
