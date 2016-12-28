// @flow

import * as _ from '../libs/underscore'
import * as d3 from '../libs/d3.v4'
import owid from '../owid'
import dataflow from './owid.dataflow'

export default function(chart : any) {
	const footer = dataflow()

    footer.needs('containerNode', 'maxBounds', 'sourcesStr', 'note', 'originUrl')

    footer.flow('g : containerNode', function(containerNode : HTMLElement) {
        return d3.select(containerNode).append('g').attr('class', 'footer')
    })

    footer.flow('noteStr : note', function(note : string) {
        return note ? `<a class="bold">Note: </a>${note}` : null;        
    })

    footer.flow('licenseStr : originUrl', function(originUrl) {
        let licenseStr = `*data-entry* • <a class="licence-link" href="http://creativecommons.org/licenses/by-sa/4.0/deed.en_US" target="_blank">CC BY-SA</a>`;

        // Make sure the link back to OWID is consistent
        if (originUrl && originUrl.includes("ourworldindata.org")) {
            const a = document.createElement('a')
            a.href = originUrl
            const path = a.pathname[0] == "/" ? a.pathname : "/" + a.pathname // MISPY: cross-browser compat (Internet Explorer doesn't have a slash)
            const finalUrl = `https://ourworldindata.org${path}${a.search}`
          licenseStr = licenseStr.replace(/\*data-entry\*/, "<a class='origin-link' target='_blank' href='" + finalUrl + "'>" + "OurWorldInData.org" + path + a.search + "</a>")
        } else {
          licenseStr = licenseStr.replace(/\*data-entry\*/, 
                "<a class='origin-link' target='_blank' href='http://ourworldindata.org'>OurWorldInData.org</a>")
        }

        return licenseStr;
    })

    // Place Data source: part into DOM
    footer.flow('sourcesLine : g', function(g) {
        return g.append('text')
            .attr('x', 0)
            .attr('y', 12)
            .attr('dy', 0);
    })
    footer.flow('sourcesBox : sourcesLine, sourcesStr, maxBounds', function(sourcesLine, sourcesStr : string, maxBounds) {
        owid.svgSetWrappedText(sourcesLine, sourcesStr, maxBounds.width, { lineHeight: 1.1 });

        sourcesLine.selectAll('.source-link').on('click', function() {
            chart.update({ activeTabName: 'sources' })
        })

        return owid.bounds(sourcesLine.node().getBBox());
    })

    // Fill license + site link but don't position it yet
    footer.flow('licenseLine : g', function(g) {
        return g.append("text").attr('x', 0).attr('y', 0).attr('dy', 0);
    })
    footer.flow('licenseBox : licenseLine, licenseStr', function(licenseLine, licenseStr : string) {
        owid.svgSetWrappedText(licenseLine, licenseStr, 10000, { lineHeight: 1.1 });
        return owid.bounds(licenseLine.node().getBBox());
    });

    // Place note, if any
    footer.flow('noteLine : g, noteStr', function(g, noteStr) {
        var noteLine = g.selectAll('.note')
        if (g.selectAll('.note').empty() && noteStr)
            return g.append('text').attr('class', 'note')
        else if (!g.selectAll('.note').empty() && !noteStr)
            noteLine.remove();
    });
    footer.flow('noteBox : noteLine, noteStr, sourcesBox, maxBounds', function(noteLine, noteStr : string, sourcesBox, maxBounds) {
        if (!noteStr) return null;

        noteLine.attr('x', 0).attr('y', sourcesBox.top+sourcesBox.height)
            .attr('dy', '1.5em');

        owid.svgSetWrappedText(noteLine, noteStr, maxBounds.width, { lineHeight: 1.1 });

        return owid.bounds(noteLine.node().getBBox());
    });

    // Position license
    footer.flow('licenseBox : licenseLine, licenseBox, sourcesBox, noteBox, maxBounds, licenseStr', function(licenseLine, licenseBox, sourcesBox, noteBox, maxBounds, licenseStr : string) {
        console.log(maxBounds.width, sourcesBox.width, licenseBox.width);
        if (maxBounds.width - sourcesBox.width > licenseBox.width+10) {
            licenseLine
                .attr('x', maxBounds.width)
                .attr('y', 12)
                .attr('dy', 0)
                .attr('text-anchor', 'end')
        } else {
            licenseLine
                .attr('x', 0)
                .attr('y', (noteBox||sourcesBox).top+(noteBox||sourcesBox).height)
                .attr('dy', '1.5em')
                .attr('text-anchor', 'start')

            owid.svgSetWrappedText(licenseLine, licenseStr, maxBounds.width, { lineHeight: 1.1 });
        }

        return owid.bounds(licenseLine.node().getBBox())
    })

    // Position footer at bottom of bounds
    footer.flow('height : g, licenseBox', function(g) {
        return owid.bounds(g.node().getBBox()).height
    })
    footer.flow('g, maxBounds, height', function(g, maxBounds, height) {
        g.attr('transform', `translate(${maxBounds.left}, ${maxBounds.top+maxBounds.height-height})`)
    })

    footer.render = function(bounds) {
        let sourcesStr : string = chart.model.get('sourceDesc')
        console.log(sourcesStr);
        if (!sourcesStr) {
            const sources = chart.data.transformDataForSources()
            const sourceNames : Array<string> = _.uniq(_.pluck(sources, 'name'))
            sourceNames.forEach((sourceName, i) => {
                 if (i > 0) sourcesStr += ", "
                 sourcesStr += sourceName
            })
        }

        footer.update({
            containerNode: chart.svgNode,
            maxBounds: bounds,
            sourcesStr: `<a class="bold">Data source: </a><a class="source-link">${sourcesStr}</a>`,
            note: chart.model.get("chart-description"),
            originUrl: chart.model.get('data-entry-url')
        })
    }

	return footer	
}
