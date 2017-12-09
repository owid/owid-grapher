import * as React from 'react'
import TextWrap from './TextWrap'
import { computed } from 'mobx'
import { observer } from 'mobx-react'
import ChartConfig from './ChartConfig'
const isNode: boolean = require('detect-node')

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

    @computed get origWidth() { return 211 }
    @computed get origHeight() { return 130 }

    @computed get scale(): number {
        return this.origHeight === 0 ? 1 : this.targetHeight / this.origHeight
    }

    @computed get width() { return this.origWidth * this.scale }
    @computed get height() { return this.origHeight * this.scale }

    render(targetX: number, targetY: number) {
        const { props, scale } = this
        const svg = (props.svg.match(/<svg>(.*)<\/svg>/) || "")[1] || props.svg
        return <g opacity={0.9} transform={`translate(${Math.round(targetX)}, ${targetY}) scale(${parseFloat(scale.toFixed(2))})`} dangerouslySetInnerHTML={{ __html: svg }} />
    }
}

interface HeaderProps {
    maxWidth: number,
    chart: ChartConfig
}

export default class Header {
    props: HeaderProps

    constructor(props: HeaderProps) {
        this.props = props
    }

    @computed get titleText() {
        return this.props.chart.data.currentTitle
    }

    @computed get subtitleText() {
        return this.props.chart.subtitle
    }

    @computed get logo(): Logo|undefined {
        const {chart} = this.props
        return chart.logosSVG ? new Logo({ svg: this.props.chart.logosSVG[0] }) : undefined
    }

    @computed get logoWidth(): number { return this.logo ? this.logo.width : 0 }
    @computed get logoHeight(): number { return this.logo ? this.logo.height : 0 }

    @computed get title() {
        const { props, logoWidth } = this
        let { titleText } = this

        const maxWidth = props.maxWidth - logoWidth - 15
        // HACK (Mispy): Stop the title jumping around during timeline transitions
        if (props.chart.data.minYear === props.chart.data.maxYear && props.chart.data.isShowingTimeline) {
            titleText = titleText + " in 2000"
        }

        // Try to fit the title into a single line if possible-- but not if it would make the text super small
        let title: TextWrap
        let fontScale = 1.5
        while (true) {
            title = new TextWrap({ maxWidth: maxWidth, fontSize: fontScale*props.chart.baseFontSize, text: titleText, lineHeight: 1 })
            if (fontScale <= 1.2 || title.lines.length <= 1)
                break
            fontScale -= 0.05
        }

        return new TextWrap({ maxWidth: maxWidth, fontSize: fontScale*props.chart.baseFontSize, text: this.titleText, lineHeight: 1 })
    }

    @computed get subtitleWidth() {
        // If the subtitle is entirely below the logo, we can go underneath it
        return this.title.height > this.logoHeight ? this.props.maxWidth : this.props.maxWidth - this.logoWidth - 10
    }

    @computed get subtitle() {
        const that = this
        return new TextWrap({
            get maxWidth() { return that.subtitleWidth },
            get fontSize() { return 0.8*that.props.chart.baseFontSize },
            get text() { return that.subtitleText }
        })
    }

    @computed get height() {
        return Math.max(this.title.height + this.subtitle.height + 2, this.logoHeight)
    }

    render(x: number, y: number) {
        return <HeaderView x={x} y={y} header={this}/>
    }
}

@observer
class HeaderView extends React.Component<{ x: number, y: number, header: Header }> {
    render() {
        const { props } = this
        const { title, titleText, logo, subtitle } = props.header
        const { chart, maxWidth } = props.header.props

        if (!isNode && !chart.isEmbed)
            document.title = titleText

        return <g className="HeaderView">
            {logo && logo.height > 0 && logo.render(props.x + maxWidth - logo.width, props.y)}
            <a href={chart.url.canonicalUrl} target="_blank">
                {title.render(props.x, props.y, { fill: "#555" })}
            </a>
            {subtitle.render(props.x, props.y + title.height + 2, { fill: "#666" })}
        </g>
    }
}
