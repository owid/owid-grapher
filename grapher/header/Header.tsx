import * as React from "react"
import { TextWrap } from "grapher/text/TextWrap"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Logo } from "grapher/chart/Logos"
import { HeaderOptionsProvider } from "./HeaderOptionsProvider"
import { BASE_FONT_SIZE } from "grapher/core/GrapherConstants"

@observer
export class Header extends React.Component<{
    maxWidth: number
    options: HeaderOptionsProvider
}> {
    @computed private get options() {
        return this.props.options
    }

    @computed private get baseFontSize() {
        return this.options.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed private get maxWidth() {
        return this.props.maxWidth
    }

    @computed private get titleText() {
        return this.options.currentTitle ?? ""
    }

    @computed private get subtitleText() {
        return this.options.subtitle ?? ""
    }

    @computed get logo() {
        const { options } = this
        if (options.hideLogo) return undefined

        return new Logo({
            logo: options.logo as any,
            isLink: !options.isNativeEmbed,
            fontSize: this.baseFontSize,
        })
    }

    @computed private get logoWidth() {
        return this.logo ? this.logo.width : 0
    }
    @computed private get logoHeight() {
        return this.logo ? this.logo.height : 0
    }

    @computed get title() {
        const { logoWidth } = this
        const maxWidth = this.maxWidth - logoWidth - 20

        // Try to fit the title into a single line if possible-- but not if it would make the text super small
        let title: TextWrap
        let fontScale = 1.4
        while (true) {
            title = new TextWrap({
                maxWidth,
                fontSize: fontScale * this.baseFontSize,
                text: this.titleText,
                lineHeight: 1,
            })
            if (fontScale <= 1.2 || title.lines.length <= 1) break
            fontScale -= 0.05
        }

        return new TextWrap({
            maxWidth,
            fontSize: fontScale * this.baseFontSize,
            text: this.titleText,
            lineHeight: 1,
        })
    }

    titleMarginBottom = 4

    @computed get subtitleWidth() {
        // If the subtitle is entirely below the logo, we can go underneath it
        return this.title.height > this.logoHeight
            ? this.maxWidth
            : this.maxWidth - this.logoWidth - 10
    }

    @computed get subtitle() {
        const that = this
        return new TextWrap({
            get maxWidth() {
                return that.subtitleWidth
            },
            get fontSize() {
                return 0.8 * that.baseFontSize
            },
            get text() {
                return that.subtitleText
            },
            lineHeight: 1.2,
            linkifyText: true,
        })
    }

    @computed get height() {
        if (this.options.isMediaCard) return 0

        return Math.max(
            this.title.height + this.subtitle.height + this.titleMarginBottom,
            this.logoHeight
        )
    }

    renderStatic(x: number, y: number) {
        const { title, logo, subtitle, options, maxWidth } = this

        if (options.isMediaCard) return null

        return (
            <g className="HeaderView">
                {logo &&
                    logo.height > 0 &&
                    logo.renderSVG(x + maxWidth - logo.width, y)}
                <a
                    href={options.canonicalUrl}
                    style={{
                        fontFamily:
                            '"Playfair Display", Georgia, "Times New Roman", serif',
                    }}
                    target="_blank"
                >
                    {title.render(x, y, { fill: "#555" })}
                </a>
                {subtitle.render(x, y + title.height + this.titleMarginBottom, {
                    fill: "#666",
                })}
            </g>
        )
    }

    render() {
        const { options } = this

        const titleStyle = {
            ...this.title.htmlStyle,
            marginBottom: this.titleMarginBottom,
        }

        const subtitleStyle = {
            ...this.subtitle.htmlStyle,
            // make sure there are no scrollbars on subtitle
            overflowY: "hidden",
        }

        return (
            <div className="HeaderHTML">
                {this.logo && this.logo.renderHTML()}
                <a href={options.canonicalUrl} target="_blank">
                    <h1 style={titleStyle}>{this.title.renderHTML()}</h1>
                </a>
                <p style={subtitleStyle}>{this.subtitle.renderHTML()}</p>
            </div>
        )
    }
}
