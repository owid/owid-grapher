import { computed } from "mobx"
import { observer } from "mobx-react"
import * as React from "react"

import { ChartConfig } from "./ChartConfig"
import { Logo, LogoOption } from "./Logos"
import { TextWrap } from "./TextWrap"

interface HeaderProps {
    maxWidth: number
    chart: ChartConfig
}

export class Header {
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

    @computed get logo(): Logo | undefined {
        if (this.props.chart.props.hideLogo) {
            return undefined
        } else {
            return new Logo({
                logo: this.props.chart.props.logo as LogoOption,
                isLink: !this.props.chart.isNativeEmbed,
                fontSize: this.props.chart.baseFontSize
            })
        }
    }

    @computed get logoWidth(): number {
        return this.logo ? this.logo.width : 0
    }
    @computed get logoHeight(): number {
        return this.logo ? this.logo.height : 0
    }

    @computed get title() {
        const { props, logoWidth } = this
        let { titleText } = this

        const maxWidth = props.maxWidth - logoWidth - 20
        // HACK (Mispy): Stop the title jumping around during timeline transitions
        if (
            props.chart.data.minYear === props.chart.data.maxYear &&
            props.chart.data.isShowingTimeline
        ) {
            titleText = titleText + " in 2000"
        }

        // Try to fit the title into a single line if possible-- but not if it would make the text super small
        let title: TextWrap
        let fontScale = 1.4
        while (true) {
            title = new TextWrap({
                maxWidth: maxWidth,
                fontSize: fontScale * props.chart.baseFontSize,
                text: titleText,
                lineHeight: 1
            })
            if (fontScale <= 1.2 || title.lines.length <= 1) break
            fontScale -= 0.05
        }

        return new TextWrap({
            maxWidth: maxWidth,
            fontSize: fontScale * props.chart.baseFontSize,
            text: this.titleText,
            lineHeight: 1
        })
    }

    @computed get titleMarginBottom(): number {
        return 4
    }

    @computed get subtitleWidth() {
        // If the subtitle is entirely below the logo, we can go underneath it
        return this.title.height > this.logoHeight
            ? this.props.maxWidth
            : this.props.maxWidth - this.logoWidth - 10
    }

    @computed get subtitle() {
        const that = this
        return new TextWrap({
            get maxWidth() {
                return that.subtitleWidth
            },
            get fontSize() {
                return 0.8 * that.props.chart.baseFontSize
            },
            get text() {
                return that.subtitleText
            }
        })
    }

    @computed get height() {
        if (this.props.chart.isMediaCard) return 0
        else
            return Math.max(
                this.title.height +
                    this.subtitle.height +
                    this.titleMarginBottom,
                this.logoHeight
            )
    }

    render(x: number, y: number) {
        return <HeaderView x={x} y={y} header={this} />
    }
}

@observer
class HeaderView extends React.Component<{
    x: number
    y: number
    header: Header
}> {
    render() {
        const { props } = this
        const { title, logo, subtitle } = props.header
        const { chart, maxWidth } = props.header.props

        if (chart.isMediaCard) return null

        return (
            <g className="HeaderView">
                {logo &&
                    logo.height > 0 &&
                    logo.renderSVG(props.x + maxWidth - logo.width, props.y)}
                <a
                    href={chart.url.canonicalUrl}
                    style={{
                        fontFamily:
                            '"Playfair Display", Georgia, "Times New Roman", serif'
                    }}
                    target="_blank"
                >
                    {title.render(props.x, props.y, { fill: "#555" })}
                </a>
                {subtitle.render(
                    props.x,
                    props.y + title.height + props.header.titleMarginBottom,
                    { fill: "#666" }
                )}
            </g>
        )
    }
}

@observer
export class HeaderHTML extends React.Component<{
    chart: ChartConfig
    header: Header
}> {
    render() {
        const { chart, header } = this.props

        const titleStyle = {
            ...header.title.htmlStyle,
            marginBottom: header.titleMarginBottom
        }

        const subtitleStyle = {
            ...header.subtitle.htmlStyle,
            // make sure there are no scrollbars on subtitle
            overflowY: "hidden"
        }

        return (
            <div className="HeaderHTML">
                {header.logo && header.logo.renderHTML()}
                <a href={chart.url.canonicalUrl} target="_blank">
                    <h1 style={titleStyle}>{header.title.renderHTML()}</h1>
                </a>
                <p style={subtitleStyle}>{header.subtitle.renderHTML()}</p>
            </div>
        )
    }
}
