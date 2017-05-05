import * as _ from 'lodash'
import * as d3 from 'd3'
import * as React from 'react'
import {computed, action} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'
import {preInstantiate} from './Util'
import Paragraph from './Paragraph'
import Text from './Text'

/*class WrappingText extends Component {
    @computed get innerSVG(): string {
        return this.props.children.join()
    }

    @computed get links(): HTMLCollection<HTMLElement> {
        // Use a dummy p element to extract the link info
        const links = []
        const p = document.createElement('p')
        p.innerHTML = this.innerSVG
        return p.children
    }

    @computed get tokens(): string[] {
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
}*/

/*@observer
export default class SVGParagraph extends React.Component<any, undefined> {
    @computed get lines() {
        const {props} = this
        const {maxWidth} = props

        const div = document.createElement('div')
        div.innerHTML = props.children
        const nodes = _.toArray(div.childNodes).reverse()


        let width = 0
        let xOffset = 0

        let node
        while (node = nodes.pop()) {
            nodes.push(..._.toArray(node.childNodes))


        }
    }

    render() {
        const {props, lines} = this
        return <text {...props} dangerouslySetInnerHTML={{__html: props.children}}/>
    }
}*/

class CCIcon extends React.Component<{ scale: number, x?: number, y?: number }, null> {
    @computed get width() {
        return 60*this.props.scale
    }

    @computed get height() {
        return 60*this.props.scale
    }

    componentDidMount() {
        //Bounds.debug([new Bounds(this.props.x, this.props.y, this.width, this.height)])
    }

    render() {
        const {props} = this

        return <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.en_US" target="_blank">
            <g fill="#999" transform={`translate(${props.x}, ${props.y}) scale(${props.scale})`}>
                <circle fill="#FFFFFF" cx="37.785" cy="28.501" r="28.836"/>
                <path d={`M37.441-3.5c8.951,0,16.572,3.125,22.857,9.372c3.008,3.009,5.295,6.448,6.857,10.314
                    c1.561,3.867,2.344,7.971,2.344,12.314c0,4.381-0.773,8.486-2.314,12.313c-1.543,3.828-3.82,7.21-6.828,10.143
                    c-3.123,3.085-6.666,5.448-10.629,7.086c-3.961,1.638-8.057,2.457-12.285,2.457s-8.276-0.808-12.143-2.429
                    c-3.866-1.618-7.333-3.961-10.4-7.027c-3.067-3.066-5.4-6.524-7-10.372S5.5,32.767,5.5,28.5c0-4.229,0.809-8.295,2.428-12.2
                    c1.619-3.905,3.972-7.4,7.057-10.486C21.08-0.394,28.565-3.5,37.441-3.5z M37.557,2.272c-7.314,0-13.467,2.553-18.458,7.657
                    c-2.515,2.553-4.448,5.419-5.8,8.6c-1.354,3.181-2.029,6.505-2.029,9.972c0,3.429,0.675,6.734,2.029,9.913
                    c1.353,3.183,3.285,6.021,5.8,8.516c2.514,2.496,5.351,4.399,8.515,5.715c3.161,1.314,6.476,1.971,9.943,1.971
                    c3.428,0,6.75-0.665,9.973-1.999c3.219-1.335,6.121-3.257,8.713-5.771c4.99-4.876,7.484-10.99,7.484-18.344
                    c0-3.543-0.648-6.895-1.943-10.057c-1.293-3.162-3.18-5.98-5.654-8.458C50.984,4.844,44.795,2.272,37.557,2.272z M37.156,23.187
                    l-4.287,2.229c-0.458-0.951-1.019-1.619-1.685-2c-0.667-0.38-1.286-0.571-1.858-0.571c-2.856,0-4.286,1.885-4.286,5.657
                    c0,1.714,0.362,3.084,1.085,4.113c0.724,1.029,1.791,1.544,3.201,1.544c1.867,0,3.181-0.915,3.944-2.743l3.942,2
                    c-0.838,1.563-2,2.791-3.486,3.686c-1.484,0.896-3.123,1.343-4.914,1.343c-2.857,0-5.163-0.875-6.915-2.629
                    c-1.752-1.752-2.628-4.19-2.628-7.313c0-3.048,0.886-5.466,2.657-7.257c1.771-1.79,4.009-2.686,6.715-2.686
                    C32.604,18.558,35.441,20.101,37.156,23.187z M55.613,23.187l-4.229,2.229c-0.457-0.951-1.02-1.619-1.686-2
                    c-0.668-0.38-1.307-0.571-1.914-0.571c-2.857,0-4.287,1.885-4.287,5.657c0,1.714,0.363,3.084,1.086,4.113
                    c0.723,1.029,1.789,1.544,3.201,1.544c1.865,0,3.18-0.915,3.941-2.743l4,2c-0.875,1.563-2.057,2.791-3.541,3.686
                    c-1.486,0.896-3.105,1.343-4.857,1.343c-2.896,0-5.209-0.875-6.941-2.629c-1.736-1.752-2.602-4.19-2.602-7.313
                    c0-3.048,0.885-5.466,2.658-7.257c1.77-1.79,4.008-2.686,6.713-2.686C51.117,18.558,53.938,20.101,55.613,23.187z`}/>
            </g>
        </a>
    }
}


interface SourcesFooterMainProps {
    x: number,
    y: number,
    maxWidth: number,
    sourcesText: string,
    notesText: string,
    licenseSvg: string,
    onSourcesClick: () => void
}

@observer
class SourcesFooterMain extends React.Component<SourcesFooterMainProps, null> {
    @computed get fontSize() {
        return 0.6
    }

    @computed get ccIcon() {
        return preInstantiate(<CCIcon scale={0.3}/>)
    }

    @computed get sources() {
        return preInstantiate(<Paragraph maxWidth={this.props.maxWidth} fontSize={this.fontSize}>{this.props.sourcesText}</Paragraph>)
    }

    @computed get notes() {
        return preInstantiate(<Paragraph maxWidth={this.props.maxWidth} fontSize={this.fontSize}>{this.props.notesText}</Paragraph>)
    }

    @computed get license() {
        const {licenseSvg} = this.props
        return preInstantiate(<Paragraph raw={true} maxWidth={this.props.maxWidth*3} fontSize={this.fontSize}>{licenseSvg}</Paragraph>)
    }

    // Put the license stuff to the side if there's room
    @computed get isCompact() {
        return this.props.maxWidth-this.sources.width-5 > this.license.width
    }

    @computed get paraMargin() {
        return 5
    }

    @computed get height() {
        const {sources, notes, license, isCompact, paraMargin} = this
        return sources.height+(notes.height ? paraMargin+notes.height : 0)+(isCompact ? 0 : paraMargin+license.height)
    }

    render() {
        const {props, sources, notes, license, ccIcon, isCompact, paraMargin} = this

        return <g className="sourcesFooter">
            <a onClick={this.props.onSourcesClick}><Paragraph {...sources.props} x={props.x} y={props.y}/></a>
            <Paragraph {...notes.props} x={props.x} y={props.y+sources.height+paraMargin}/>
            {isCompact
                ? <Paragraph {...license.props} x={props.x+props.maxWidth-license.width} y={props.y}/>
                : <Paragraph {...license.props} x={props.x} y={props.y+sources.height+paraMargin+(notes.height ? notes.height+paraMargin : 0)}/>
            }
            {/*<CCIcon {...ccIcon.props} x={props.x+props.maxWidth-ccIcon.width-5} y={props.y+this.height-ccIcon.height-5}/>*/}
        </g>
    }
}

interface SourcesFooterProps {
    bounds: Bounds,
    note: string,
    originUrl: string,
    chartView: any
}

export default class SourcesFooter extends React.Component<SourcesFooterProps, null> {
    @computed get sourcesText(): string {
        let sourcesStr: string = this.props.chartView.model.get('sourceDesc')
        if (!sourcesStr) {
            const sources = this.props.chartView.data.transformDataForSources()
            const sourceNames = _.uniq(_.map(sources, 'name'))
            sourceNames.forEach((sourceName, i) => {
                 if (i > 0) sourcesStr += ", "
                 sourcesStr += sourceName
            })
        }
        return sourcesStr ? `Source: ${sourcesStr}` : ''
    }

    @computed get notesText(): string {
        return this.props.note ? `Note: ${this.props.note}` : '';
    }

    @computed get licenseSvg(): string {
        const {originUrl} = this.props
        let licenseSvg = `*data-entry* • <a class="licence-link" href="http://creativecommons.org/licenses/by-sa/4.0/deed.en_US" target="_blank">CC BY-SA</a>`;

        // Make sure the link back to OWID is consistent
        if (originUrl && originUrl.indexOf("ourworldindata.org") !== -1) {
            const a = document.createElement('a')
            a.href = originUrl
            const path = a.pathname[0] == "/" ? a.pathname : "/" + a.pathname // MISPY: cross-browser compat (Internet Explorer doesn't have a slash)
            const finalUrl = `https://ourworldindata.org${path}${a.search}`
          licenseSvg = licenseSvg.replace(/\*data-entry\*/, "<a class='origin-link' target='_blank' href='" + finalUrl + "'>" + "OurWorldInData.org" + path + a.search + "</a>")
        } else {
          licenseSvg = licenseSvg.replace(/\*data-entry\*/,
                "<a class='origin-link' target='_blank' href='http://ourworldindata.org'>OurWorldInData.org</a>")
        }

        return licenseSvg;
    }

    @computed get footerMain() {
        const {sourcesText, notesText, licenseSvg} = this
        return preInstantiate(<SourcesFooterMain sourcesText={sourcesText} notesText={notesText} licenseSvg={licenseSvg} maxWidth={this.props.bounds.width} onSourcesClick={this.onSourcesClick}/>)
    }

    @computed get height() {
        return this.footerMain.height
    }

    @action.bound onSourcesClick() {
        this.props.chartView.update({ activeTabName: 'sources' })
    }

    render() {
        const {props, footerMain} = this
        return <SourcesFooterMain {...footerMain.props} x={props.bounds.left} y={props.bounds.bottom-footerMain.height}/>
    }
}

/*function(chart : any) {
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
          licenseStr = licenseStr.replace(/data-entry/, "<a class='origin-link' target='_blank' href='" + finalUrl + "'>" + "OurWorldInData.org" + path + a.search + "</a>")
        } else {
          licenseStr = licenseStr.replace(/data-entry/,
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


        footer.update({
            containerNode: chart.svgNode,
            maxBounds: bounds,
            sourcesStr: `<a class="bold">Data source: </a><a class="source-link">${sourcesStr}</a>`,
            note: chart.model.get("chart-description"),
            originUrl: chart.model.get('data-entry-url')
        })

        //rootNode =
    }

	return footer
}*/
