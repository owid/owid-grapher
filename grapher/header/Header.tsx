import * as React from "react"
import { TextWrap } from "grapher/text/TextWrap"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Logo } from "grapher/chart/Logos"
import { HeaderManager } from "./HeaderManager"
import { BASE_FONT_SIZE } from "grapher/core/GrapherConstants"

@observer
export class Header extends React.Component<{
    manager: HeaderManager
}> {
    @computed private get manager() {
        return this.props.manager
    }

    @computed private get fontSize() {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get maxWidth() {
        return this.manager.maxWidth ?? 500
    }

    @computed private get titleText() {
        return this.manager.currentTitle ?? ""
    }

    @computed private get subtitleText() {
        return this.manager.subtitle ?? ""
    }

    @computed get logo() {
        const { manager } = this
        if (manager.hideLogo) return undefined

        return new Logo({
            logo: manager.logo as any,
            isLink: !manager.isNativeEmbed,
            fontSize: this.fontSize,
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
                fontSize: fontScale * this.fontSize,
                text: this.titleText,
                lineHeight: 1,
            })
            if (fontScale <= 1.2 || title.lines.length <= 1) break
            fontScale -= 0.05
        }

        return new TextWrap({
            maxWidth,
            fontSize: fontScale * this.fontSize,
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
        return new TextWrap({
            maxWidth: this.subtitleWidth,
            fontSize: 0.8 * this.fontSize,
            text: this.subtitleText,
            lineHeight: 1.2,
            linkifyText: true,
        })
    }

    @computed get height() {
        if (this.manager.isMediaCard) return 0

        return Math.max(
            this.title.height + this.subtitle.height + this.titleMarginBottom,
            this.logoHeight
        )
    }

    renderStatic(x: number, y: number) {
        const { title, logo, subtitle, manager, maxWidth } = this

        if (manager.isMediaCard) return null

        return (
            <g className="HeaderView">
                {logo &&
                    logo.height > 0 &&
                    logo.renderSVG(x + maxWidth - logo.width, y)}
                <a
                    href={manager.canonicalUrl}
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
        const { manager } = this

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
                <a href={manager.canonicalUrl} target="_blank">
                    <h1 style={titleStyle}>{this.title.renderHTML()}</h1>
                </a>
                <p style={subtitleStyle}>{this.subtitle.renderHTML()}</p>
            </div>
        )
    }
}
