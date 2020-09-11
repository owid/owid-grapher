import * as React from "react"
import { TextWrap } from "grapher/text/TextWrap"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Grapher } from "grapher/core/Grapher"
import { Logo } from "grapher/chart/Logos"

interface HeaderProps {
    maxWidth: number
    grapher: Grapher
}

export class Header {
    props: HeaderProps

    constructor(props: HeaderProps) {
        this.props = props
    }

    @computed private get titleText() {
        return this.props.grapher.currentTitle
    }

    @computed private get subtitleText() {
        return this.props.grapher.subtitle
    }

    @computed get logo(): Logo | undefined {
        if (this.props.grapher.hideLogo) {
            return undefined
        } else {
            return new Logo({
                logo: this.props.grapher.logo,
                isLink: !this.props.grapher.isNativeEmbed,
                fontSize: this.props.grapher.baseFontSize,
            })
        }
    }

    @computed private get logoWidth(): number {
        return this.logo ? this.logo.width : 0
    }
    @computed private get logoHeight(): number {
        return this.logo ? this.logo.height : 0
    }

    @computed get title() {
        const { props, logoWidth } = this
        const maxWidth = props.maxWidth - logoWidth - 20

        // Try to fit the title into a single line if possible-- but not if it would make the text super small
        let title: TextWrap
        let fontScale = 1.4
        while (true) {
            title = new TextWrap({
                maxWidth: maxWidth,
                fontSize: fontScale * props.grapher.baseFontSize,
                text: this.titleText,
                lineHeight: 1,
            })
            if (fontScale <= 1.2 || title.lines.length <= 1) break
            fontScale -= 0.05
        }

        return new TextWrap({
            maxWidth: maxWidth,
            fontSize: fontScale * props.grapher.baseFontSize,
            text: this.titleText,
            lineHeight: 1,
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
                return 0.8 * that.props.grapher.baseFontSize
            },
            get text() {
                return that.subtitleText
            },
            get lineHeight() {
                return 1.2
            },
            get linkifyText() {
                return true
            },
        })
    }

    @computed get height() {
        if (this.props.grapher.isMediaCard) return 0
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
        const { grapher, maxWidth } = props.header.props

        if (grapher.isMediaCard) return null

        return (
            <g className="HeaderView">
                {logo &&
                    logo.height > 0 &&
                    logo.renderSVG(props.x + maxWidth - logo.width, props.y)}
                <a
                    href={grapher.url.canonicalUrl}
                    style={{
                        fontFamily:
                            '"Playfair Display", Georgia, "Times New Roman", serif',
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
    grapher: Grapher
    header: Header
}> {
    render() {
        const { grapher, header } = this.props

        const titleStyle = {
            ...header.title.htmlStyle,
            marginBottom: header.titleMarginBottom,
        }

        const subtitleStyle = {
            ...header.subtitle.htmlStyle,
            // make sure there are no scrollbars on subtitle
            overflowY: "hidden",
        }

        return (
            <div className="HeaderHTML">
                {header.logo && header.logo.renderHTML()}
                <a href={grapher.url.canonicalUrl} target="_blank">
                    <h1 style={titleStyle}>{header.title.renderHTML()}</h1>
                </a>
                <p style={subtitleStyle}>{header.subtitle.renderHTML()}</p>
            </div>
        )
    }
}
