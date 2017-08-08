import * as _ from 'lodash'
import * as React from 'react'
import Bounds from './Bounds'
import Text from './Text'
import TextWrap from './TextWrap'
import {preInstantiate} from './Util'
import {observable, computed} from 'mobx'
import {observer} from 'mobx-react'
import {formatYear} from './Util'
import ChartConfig from './ChartConfig'

interface LogoProps {
    svg: string
}

class Logo {
    props: LogoProps
    constructor(props: LogoProps) {
        this.props = props
    }

    @computed get targetHeight() {
        return 40
    }

    @computed get bbox() {
        var div = document.createElement('div');
        div.innerHTML = this.props.svg;
        document.body.appendChild(div)
        const bbox = (div.childNodes[0] as SVGSVGElement).getBBox()
        document.body.removeChild(div)
        return bbox
    }

    @computed get scale() {        
        return this.bbox.height == 0 ? 1 : this.targetHeight/this.bbox.height;
    }

    @computed get width() { return this.bbox.width*this.scale }
    @computed get height() { return this.bbox.height*this.scale }

    render(targetX: number, targetY: number) {
        const {props, scale} = this
        const svg = (props.svg.match(/<svg>(.*)<\/svg>/)||"")[1]||props.svg
        return <g opacity={0.9} transform={`translate(${Math.round(targetX)}, ${targetY}) scale(${parseFloat(scale.toFixed(2))})`} dangerouslySetInnerHTML={{ __html: svg }}/>
    }
}

interface HeaderProps {
    maxWidth: number,
    minYear: number|null,
    maxYear: number|null,
    chart: ChartConfig
}

export default class Header {
    props: HeaderProps
    constructor(props: HeaderProps) {
        this.props = props
    }

    fillTemplate(text: string) {
        const {chart, minYear, maxYear} = this.props
        const {selectedKeys} = chart.data

        if (_.includes(text, "*country*")) {
            const entityStr = selectedKeys.join(', ');
            if (entityStr.length > 0)
                text = text.replace("*country*", entityStr);
            else {
                text = text.replace(", *country*", "")
                text = text.replace("*country*", "");                
            }
        }

        if (_.includes(text, "*time")) {
            if (!_.isFinite(minYear)) {
                text = text.replace(", *time*", "")
                text = text.replace("*time*", "");
            } else {
                var timeFrom = formatYear(minYear as number),
                    timeTo = formatYear(_.isFinite(maxYear) ? maxYear as number : minYear as number),
                    time = timeFrom === timeTo ? timeFrom : timeFrom + " to " + timeTo;

                text = text.replace("*time*", time);
                text = text.replace("*timeFrom*", timeFrom);
                text = text.replace("*timeTo*", timeTo);
            }
        }

        return text.trim();
    }

    @computed get titleText() {
        return this.fillTemplate(this.props.chart.title)
    }

    @computed get subtitleText() {
        return this.fillTemplate(this.props.chart.subtitle)
    }

    @computed get logo() {
        return new Logo({ svg: this.props.chart.logosSVG[0] })
    }

    @computed get title() {
        const {props, logo, titleText} = this

        // Try to fit the title into a single line if possible-- but not if it would make the text super small
        let title: TextWrap
        let fontSize = 1.25
        while (true) {
            title = new TextWrap({ maxWidth: props.maxWidth-logo.width-10, fontSize: fontSize, text: titleText, lineHeight: 1 })
            if (fontSize <= 0.9 || title.lines.length <= 1)
                break
            fontSize -= 0.05
        }

        if (title.lines.length > 1)
            fontSize = 1.1

        return title
    }

    @computed get subtitleWidth() {
        // If the subtitle is entirely below the logo, we can go underneath it
        return this.title.height > this.logo.height ? this.props.maxWidth : this.props.maxWidth-this.logo.width-10
    }

    @computed get subtitle() {
        const _this = this
        return new TextWrap({
            get maxWidth() { return _this.subtitleWidth },
            get fontSize() { return 0.6 },
            get text() { return _this.subtitleText }
        })
    }

    @computed get height() {
        return Math.max(this.title.height+this.subtitle.height+2, this.logo.height)
    }

    render(x: number, y: number) {
        return <HeaderView x={x} y={y} header={this}/>
    }
}

@observer
class HeaderView extends React.Component<{ x: number, y: number, header: Header }> {
    render() {
        const {props} = this
        const {title, titleText, logo, subtitle} = props.header
        const {chart, maxWidth} = props.header.props

        document.title = titleText

        return <g className="HeaderView">
            {logo.height > 0 && logo.render(props.x+maxWidth-logo.width, props.y)}
            <a href={chart.url.canonicalUrl} target="_blank">
                {title.render(props.x, props.y, { fill: "#555" })}
            </a>
            {subtitle.render(props.x, props.y+title.height+2, { fill: "#666" })}
        </g>
    }
}