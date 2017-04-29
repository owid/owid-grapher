// @flow

import _ from 'lodash'
import * as d3 from 'd3'
import owid from '../owid'
import dataflow from './owid.dataflow'
import React, {Component} from 'react'
import {render} from 'preact'
import {computed} from 'mobx'
import Bounds from './Bounds'

class WrappingText extends Component {
    @computed get innerSVG() : string {
        return this.props.children.join()
    }

    @computed get links() : HTMLCollection<HTMLElement> {
        // Use a dummy p element to extract the link info
        const links = []
        const p = document.createElement('p')
        p.innerHTML = this.innerSVG
        return p.children
    }

    @computed get tokens() : string[] {
        let content = this.innerSVG

        // Now indicate them with our own tags
        content = content.replace(/<[^\/][^>]*>/g, " <LINKSTART> ");
        content = content.replace(/<\/[^>]+>/g, " <LINKSTOP> ");

        // Clean the content
        content = s.trim(content.replace("</br>", "\n").replace("<br>", "\n"));

        return s.trim(content).split(/ +/)
    }

    render() {
        for (let token of this.tokens) {
            console.log(token)
        }
    }
}

class SourcesFooter extends Component {
    static calculateBounds(containerBounds : Bounds) {
    }

    props: {
        bounds: Bounds,
        note: string,
        originUrl: string,
        sourcesStr: string
    }

    @computed get sourcesStr() : string {
        return this.props.sourcesStr ? `<a class="bold">Data source: </a><a class="source-link">${this.props.sourcesStr}</a>` : ''
    }

    @computed get noteStr() : string {
        return this.props.note ? `<a class="bold">Note: </a>${this.props.note}` : '';
    }

    @computed get licenseStr() : string {
        const {originUrl} = this.props
        let licenseStr = `*data-entry* • <a class="licence-link" href="http://creativecommons.org/licenses/by-sa/4.0/deed.en_US" target="_blank">CC BY-SA</a>`;

        // Make sure the link back to OWID is consistent
        if (originUrl && originUrl.indexOf("ourworldindata.org") !== -1) {
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
    }

    render() {
        const {sourcesStr, noteStr, licenseStr} = this
        return <g class="footer">
            {layout(this.props.bounds,
                <WrappingText>{sourcesStr}</WrappingText>,
                <WrappingText>{noteStr}</WrappingText>,
                <WrappingText>{licenseStr}</WrappingText>
            )}
        </g>
    }
}

export default function(chart : any) {
	const footer = dataflow()

    footer.needs('containerNode', 'maxBounds')

    footer.inputs({
        sourcesStr: '',
        note: '',
        originUrl: ''
    })

    footer.flow('g : containerNode', function(containerNode : HTMLElement) {
        return d3.select(containerNode).append('g').attr('class', 'footer')
    })

    footer.flow('noteStr : note', function(note : string) {
        return note ? `<a class="bold">Note: </a>${note}` : null;
    })

    footer.flow('licenseStr : originUrl', function(originUrl) {
        let licenseStr = `*data-entry* • <a class="licence-link" href="http://creativecommons.org/licenses/by-sa/4.0/deed.en_US" target="_blank">CC BY-SA</a>`;

        // Make sure the link back to OWID is consistent
        if (originUrl && originUrl.indexOf("ourworldindata.org") !== -1) {
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

        return Bounds.fromBBox(sourcesLine.node().getBBox());
    })

    // Fill license + site link but don't position it yet
    footer.flow('licenseLine : g', function(g) {
        return g.append("text").attr('x', 0).attr('y', 0).attr('dy', 0);
    })
    footer.flow('licenseBox : licenseLine, licenseStr', function(licenseLine, licenseStr : string) {
        owid.svgSetWrappedText(licenseLine, licenseStr, 10000, { lineHeight: 1.1 });
        return Bounds.fromBBox(licenseLine.node().getBBox());
    });

    // Place note, if any
    footer.flow('noteLine : g, noteStr', function(g, noteStr) {
        var noteLine = g.selectAll('.note')
        if (noteLine.empty() && noteStr)
            noteLine = g.append('text').attr('class', 'note')
        else if (!noteLine.empty() && !noteStr)
            noteLine.remove();
        return noteLine
    });
    footer.flow('noteBox : noteLine, noteStr, sourcesBox, maxBounds', function(noteLine, noteStr : string, sourcesBox, maxBounds) {
        if (!noteStr) return null;

        noteLine.attr('x', 0).attr('y', sourcesBox.top+sourcesBox.height)
            .attr('dy', '1.5em');

        owid.svgSetWrappedText(noteLine, noteStr, maxBounds.width, { lineHeight: 1.1 });

        return Bounds.fromBBox(noteLine.node().getBBox());
    });

    // Position license
    footer.flow('licenseBox : licenseLine, licenseBox, sourcesBox, noteBox, maxBounds, licenseStr', function(licenseLine, licenseBox, sourcesBox, noteBox, maxBounds, licenseStr : string) {
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

        return Bounds.fromBBox(licenseLine.node().getBBox())
    })

    // Position footer at bottom of bounds
    footer.flow('height : g, licenseBox', function(g) {
        return Bounds.fromBBox(g.node().getBBox()).height
    })
    footer.flow('g, maxBounds, height', function(g, maxBounds, height) {
        g.attr('transform', `translate(${maxBounds.left}, ${maxBounds.top+maxBounds.height-height})`)
    })

    let rootNode = null
    footer.render = function(bounds) {
        let sourcesStr : string = chart.model.get('sourceDesc')
        if (!sourcesStr) {
            const sources = chart.data.transformDataForSources()
            const sourceNames : Array<string> = _.uniq(_.map(sources, 'name'))
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

        //rootNode = render(<SourcesFooter bounds={bounds} sourcesStr={sourcesStr} note={chart.model.get('chart-description')} originUrl={chart.model.get('data-entry-url')} />, chart.svgNode, rootNode)
    }

	return footer
}
