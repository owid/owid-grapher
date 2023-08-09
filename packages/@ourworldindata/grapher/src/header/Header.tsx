import React from "react"
import {
    TextWrap,
    DEFAULT_BOUNDS,
    MarkdownTextWrap,
} from "@ourworldindata/utils"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Logo } from "../captionedChart/Logos"
import { HeaderManager } from "./HeaderManager"
import { BASE_FONT_SIZE } from "../core/GrapherConstants"

@observer
export class Header extends React.Component<{
    manager: HeaderManager
    maxWidth?: number
}> {
    @computed private get manager(): HeaderManager {
        return this.props.manager
    }

    @computed private get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_BOUNDS.width
    }

    @computed private get titleText(): string {
        return this.manager.currentTitle ?? ""
    }

    @computed private get subtitleText(): string {
        return this.manager.subtitle ?? ""
    }

    @computed get logo(): Logo | undefined {
        const { manager } = this
        if (manager.hideLogo) return undefined

        return new Logo({
            logo: manager.logo as any,
            isLink: !!manager.shouldLinkToOwid,
            fontSize: this.fontSize,
        })
    }

    @computed private get logoWidth(): number {
        return this.logo ? this.logo.width : 0
    }

    @computed get logoHeight(): number {
        return this.logo ? this.logo.height : 0
    }

    @computed get title(): TextWrap {
        const { logoWidth, manager } = this
        return new TextWrap({
            maxWidth: this.maxWidth - logoWidth - 24,
            fontWeight: !manager.isExportingtoSvgOrPng ? 600 : undefined,
            lineHeight: 1.2,
            fontSize: 1.25 * this.fontSize,
            text: this.titleText,
        })
    }

    subtitleMarginTop = 4

    @computed get subtitleWidth(): number {
        // If the subtitle is entirely below the logo, we can go underneath it
        return this.title.height > this.logoHeight
            ? this.maxWidth
            : this.maxWidth - this.logoWidth - 10
    }

    @computed get subtitle(): MarkdownTextWrap {
        return new MarkdownTextWrap({
            maxWidth: this.subtitleWidth,
            fontSize: 0.8 * this.fontSize,
            text: this.subtitleText,
            lineHeight: 1.2,
            detailsOrderedByReference: this.manager
                .shouldIncludeDetailsInStaticExport
                ? this.manager.detailsOrderedByReference
                : new Set(),
        })
    }

    @computed get height(): number {
        const { title, subtitle, subtitleText, subtitleMarginTop } = this
        return (
            title.height +
            (subtitleText ? subtitle.height + subtitleMarginTop : 0)
        )
    }

    renderStatic(x: number, y: number): JSX.Element {
        const { title, logo, subtitle, manager, maxWidth } = this

        return (
            <g className="HeaderView">
                {logo &&
                    logo.height > 0 &&
                    logo.renderSVG(x + maxWidth - logo.width, y)}
                <a
                    href={manager.canonicalUrl}
                    style={{
                        fontFamily:
                            "'Playfair Display', Georgia, 'Times New Roman', 'Liberation Serif', serif",
                    }}
                    target="_blank"
                    rel="noopener"
                >
                    {title.render(x, y, { fill: "#4E4E4E" })}
                </a>
                {subtitle.renderSVG(
                    x,
                    y + title.height + this.subtitleMarginTop,
                    {
                        fill: "#4E4E4E",
                    }
                )}
            </g>
        )
    }

    render(): JSX.Element {
        const { manager } = this

        const subtitleStyle = {
            ...this.subtitle.style,
            marginTop: this.subtitleMarginTop,
            // make sure there are no scrollbars on subtitle
            overflowY: "hidden",
        }

        return (
            <div className="HeaderHTML">
                {this.logo && this.logo.renderHTML()}
                <a
                    href={manager.canonicalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <h1 style={this.title.htmlStyle}>
                        {this.title.renderHTML()}
                    </h1>
                </a>
                <p style={subtitleStyle}>{this.subtitle.renderHTML()}</p>
            </div>
        )
    }
}
