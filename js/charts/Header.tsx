import * as _ from 'lodash'
import * as React from 'react'
import Bounds from './Bounds'
import Text from './Text'
import Paragraph from './Paragraph'
import {preInstantiate} from './Util'
import {observable, computed} from 'mobx'
import {observer} from 'mobx-react'
import {formatYear} from './Util'

interface LogoProps {
    x: number,
    y: number,
    svg: string
}

@observer
class Logo extends React.Component<LogoProps> {
    static bboxCache: {[svg: string]: SVGRect} = {}

    @computed get targetHeight() {
        return 40
    }

    @computed get bbox() {
        if (Logo.bboxCache[this.props.svg])
            return Logo.bboxCache[this.props.svg]

        var div = document.createElement('div');
        div.innerHTML = this.props.svg;
        document.body.appendChild(div)
        const bbox = (div.childNodes[0] as SVGSVGElement).getBBox()
        document.body.removeChild(div)

        Logo.bboxCache[this.props.svg] = bbox
        return bbox
    }

    @computed get scale() {        
        return this.bbox.height == 0 ? 1 : this.targetHeight/this.bbox.height;
    }

    @computed get width() { return this.bbox.width*this.scale }
    @computed get height() { return this.bbox.height*this.scale }

    render() {
        const {props, scale} = this
        const svg = (props.svg.match(/<svg>(.*)<\/svg>/)||"")[1]||props.svg
        return <g opacity={0.9} transform={`translate(${props.x}, ${props.y}) scale(${scale})`} dangerouslySetInnerHTML={{ __html: svg }}/>
    }
}

interface HeaderMainProps {
    x: number,
    y: number,
    width: number,
    title: string,
    titleLink: string,
    subtitle: string,
    logosSVG: string[]
}

@observer
class HeaderMain extends React.Component<HeaderMainProps> {
    @computed get logoSVG() {
        return this.props.logosSVG[0]
    }

    @computed get logo() {
        return preInstantiate(<Logo x={0} y={0} svg={this.logoSVG}/>)
    }

    @computed get title() {
        const {props, logo} = this

        // Try to fit the title into a single line if possible-- but not if it would make the text super small
        let title = null
        let fontSize = 1.25
        while (fontSize > 0.9) {
            title = preInstantiate(<Paragraph width={props.width-logo.width-10} fontSize={fontSize} style={{ fill: "#555" }} lineHeight={1}>{props.title.trim()}</Paragraph>)
            if (title.lines.length <= 1)
                break
            fontSize -= 0.05
        }

        if (title.lines.length > 1)
            fontSize = 1.1

        return title
    }

    @computed get subtitle() {
        const {props, logo, title} = this

        // If the subtitle is entirely below the logo, we can go underneath it
        const subtitleWidth = title.height > logo.height ? props.width : props.width-logo.width-10

        // Subtitle text must always be smaller than title text.
        var fontSize = 0.6;

        return preInstantiate(<Paragraph width={subtitleWidth} fontSize={fontSize} style={{ fill: "#666" }}>{props.subtitle.trim()}</Paragraph>)
    }

    @computed get height() {
        return Math.max(this.title.height+this.subtitle.height+2, this.logo.height)
    }

    render() {
        const {props, logo, title, subtitle} = this

        //Bounds.debug([new Bounds(props.x, props.y+title.height+2, subtitle.width, subtitle.height)])

        return <g className="header">
            {logo.height > 0 && <Logo {...logo.props} x={props.x+props.width-logo.width} y={props.y}/>}
            <a href={props.titleLink} target="_blank">
                <Paragraph {...title.props} x={props.x} y={props.y}>{title.text}</Paragraph>
            </a>
            <Paragraph {...subtitle.props} x={props.x} y={props.y+title.height+2}>{subtitle.text}</Paragraph>
        </g>
    }
}

interface HeaderProps {
    bounds: Bounds,
    titleTemplate: string,
    subtitleTemplate: string,
    minYear: number,
    maxYear: number,
    entities: any[],
    logosSVG: string[],
    titleLink: string
}

@observer
export default class Header extends React.Component<HeaderProps> {
    fillTemplate(text: string) {
        const {entities, minYear, maxYear} = this.props

        if (_.includes(text, "*country*")) {
            const entityStr = entities.join(', ');
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
                var timeFrom = formatYear(minYear),
                    timeTo = formatYear(_.isFinite(maxYear) ? maxYear : minYear),
                    time = timeFrom === timeTo ? timeFrom : timeFrom + " to " + timeTo;

                text = text.replace("*time*", time);
                text = text.replace("*timeFrom*", timeFrom);
                text = text.replace("*timeTo*", timeTo);
            }
        }

        return text;
    }

    @computed get title() {
        return this.fillTemplate(this.props.titleTemplate)
    }

    @computed get subtitle() {
        return this.fillTemplate(this.props.subtitleTemplate)
    }

    @computed get headerMain() {
        const {props, title, subtitle} = this
        const {bounds, logosSVG, titleLink} = props

        return preInstantiate(
            <HeaderMain x={bounds.x} y={bounds.y} width={bounds.width} title={title} subtitle={subtitle} logosSVG={logosSVG} titleLink={titleLink}/>
        )
    }

    @computed get height() {
        return this.headerMain.height
    }

    render() {
        const {headerMain, title} = this

        document.title = title
        return <HeaderMain {...headerMain.props}/>
    }
}