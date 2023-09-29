import React from "react"
import {
    TextWrap,
    DEFAULT_BOUNDS,
    MarkdownTextWrap,
} from "@ourworldindata/utils"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Logo, LogoOption } from "../captionedChart/Logos"
import { HeaderManager } from "./HeaderManager"

@observer
export class Header extends React.Component<{
    manager: HeaderManager
    maxWidth?: number
}> {
    @computed private get manager(): HeaderManager {
        return this.props.manager
    }

    @computed protected get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_BOUNDS.width
    }

    @computed private get titleText(): string {
        return this.manager.currentTitle ?? ""
    }

    @computed private get subtitleText(): string {
        return this.manager.currentSubtitle ?? ""
    }

    @computed get logo(): Logo | undefined {
        const { manager } = this
        if (manager.hideLogo) return undefined
        const isOwidLogo = !manager.logo || manager.logo === LogoOption.owid
        return new Logo({
            logo: manager.logo as any,
            isLink: !!manager.shouldLinkToOwid,
            heightScale: manager.isSmall && !isOwidLogo ? 0.775 : 1,
            useSmallVersion: manager.isSmall && isOwidLogo,
        })
    }

    @computed private get logoWidth(): number {
        return this.logo ? this.logo.width : 0
    }

    @computed private get logoHeight(): number {
        return this.logo ? this.logo.height : 0
    }

    @computed get title(): TextWrap {
        const { logoWidth } = this
        const fontSize = this.manager.isNarrow
            ? 18
            : this.manager.isMedium
            ? 20
            : 24
        return new TextWrap({
            maxWidth: this.maxWidth - logoWidth - 24,
            fontWeight: 600,
            lineHeight: this.manager.isSmall ? 1.1 : 1.2,
            fontSize,
            text: this.titleText,
        })
    }

    @computed get subtitleMarginTop(): number {
        return 4
    }

    @computed get subtitleWidth(): number {
        // If the subtitle is entirely below the logo, we can go underneath it
        return this.title.height > this.logoHeight
            ? this.maxWidth
            : this.maxWidth - this.logoWidth - 12
    }

    @computed get subtitle(): MarkdownTextWrap {
        const fontSize = this.manager.isSmall
            ? 12
            : this.manager.isMedium
            ? 13
            : 14
        const lineHeight = this.manager.isMedium ? 1.2 : 1.28571
        return new MarkdownTextWrap({
            maxWidth: this.subtitleWidth,
            fontSize,
            text: this.subtitleText,
            lineHeight,
            detailsOrderedByReference: this.manager
                .shouldIncludeDetailsInStaticExport
                ? this.manager.detailsOrderedByReference
                : new Set(),
        })
    }

    @computed get height(): number {
        const { title, subtitle, subtitleText, subtitleMarginTop, logoHeight } =
            this
        return Math.max(
            title.height +
                (subtitleText ? subtitle.height + subtitleMarginTop : 0),
            logoHeight
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
                        fontWeight: 500,
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

    private renderTitle(): JSX.Element {
        const { manager } = this

        // on smaller screens, make the whole width of the header clickable
        if (manager.isMedium) {
            return (
                <a
                    href={manager.canonicalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <h1 style={this.title.htmlStyle}>
                        {this.title.renderHTML()}
                    </h1>
                </a>
            )
        }

        // on larger screens, only make the title text itself clickable
        return (
            <h1 style={this.title.htmlStyle}>
                <a
                    href={manager.canonicalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {this.title.renderHTML()}
                </a>
            </h1>
        )
    }

    private renderSubtitle(): JSX.Element {
        const style = {
            ...this.subtitle.style,
            marginTop: this.subtitleMarginTop,
            // make sure there are no scrollbars on subtitle
            overflowY: "hidden",
        }
        return <p style={style}>{this.subtitle.renderHTML()}</p>
    }

    render(): JSX.Element {
        return (
            <div className="HeaderHTML">
                {this.logo && this.logo.renderHTML()}
                <div style={{ minHeight: this.height }}>
                    {this.renderTitle()}
                    {this.subtitleText && this.renderSubtitle()}
                </div>
            </div>
        )
    }
}
