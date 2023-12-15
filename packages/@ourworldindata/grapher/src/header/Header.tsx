import React from "react"
import { DEFAULT_BOUNDS, range } from "@ourworldindata/utils"
import { MarkdownTextWrap, TextWrap } from "@ourworldindata/components"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Logo, LogoOption } from "../captionedChart/Logos"
import { HeaderManager } from "./HeaderManager"
import {
    DEFAULT_GRAPHER_FRAME_PADDING,
    GRAPHER_DARK_TEXT,
} from "../core/GrapherConstants"

interface HeaderProps {
    manager: HeaderManager
    maxWidth?: number
}

@observer
export class Header<
    Props extends HeaderProps = HeaderProps,
> extends React.Component<Props> {
    @computed protected get manager(): HeaderManager {
        return this.props.manager
    }

    @computed protected get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_BOUNDS.width
    }

    @computed private get framePaddingHorizontal(): number {
        return (
            this.manager.framePaddingHorizontal ?? DEFAULT_GRAPHER_FRAME_PADDING
        )
    }

    @computed private get framePaddingVertical(): number {
        return (
            this.manager.framePaddingVertical ?? DEFAULT_GRAPHER_FRAME_PADDING
        )
    }

    @computed protected get titleText(): string {
        return this.manager.currentTitle?.trim() ?? ""
    }

    @computed private get subtitleText(): string {
        return this.manager.currentSubtitle?.trim() ?? ""
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

    @computed protected get logoWidth(): number {
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
        const fontSize = this.manager.isGeneratingThumbnail
            ? (14 / 16) * (this.manager.fontSize ?? 16) // respect base font size for thumbnails
            : this.manager.isSmall
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

    private renderTitle(): JSX.Element {
        const { manager } = this

        // avoid linking to a grapher/data page when we're already on it
        if (manager.isOnCanonicalUrl && !this.manager.isInIFrame) {
            return (
                <h1 style={this.title.htmlStyle}>{this.title.renderHTML()}</h1>
            )
        }

        // on smaller screens, make the whole width of the header clickable
        if (manager.isMedium) {
            return (
                <a
                    href={manager.canonicalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-track-note="chart_click_title"
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
                    data-track-note="chart_click_title"
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
            <div
                className="HeaderHTML"
                style={{
                    padding: `${this.framePaddingVertical}px ${this.framePaddingHorizontal}px`,
                    paddingBottom: 0,
                }}
            >
                {this.logo && this.logo.renderHTML()}
                <div style={{ minHeight: this.height }}>
                    {this.renderTitle()}
                    {this.subtitleText && this.renderSubtitle()}
                </div>
            </div>
        )
    }
}

interface StaticHeaderProps extends HeaderProps {
    targetX: number
    targetY: number
}

@observer
export class StaticHeader extends Header<StaticHeaderProps> {
    @computed get title(): TextWrap {
        const { logoWidth, titleText, manager } = this

        const makeTitle = (fontSize: number): TextWrap =>
            new TextWrap({
                text: titleText,
                maxWidth: this.maxWidth - logoWidth - 24,
                fontSize,
                fontWeight: 600,
                lineHeight: 1.2,
            })

        // try to fit the title into a single line if possible-- but not if it would make the text too small
        const initialFontSize = manager.isGeneratingThumbnail
            ? (24 / 16) * (manager.fontSize ?? 16) // respect base font size for thumbnails
            : 24
        let title = makeTitle(initialFontSize)

        // if the title is already a single line, no need to decrease font size
        if (title.lines.length <= 1) return title

        const originalLineCount = title.lines.length
        // decrease the initial font size by no more than 20% using 0.5px steps
        const potentialFontSizes = range(
            initialFontSize,
            initialFontSize * 0.8,
            -0.5
        )
        for (const fontSize of potentialFontSizes) {
            title = makeTitle(fontSize)
            const currentLineCount = title.lines.length
            if (currentLineCount <= 1 || currentLineCount < originalLineCount)
                break
        }
        // return the title at the new font size: either it now fits into a single line, or
        // its size has been reduced so the multi-line title doesn't take up quite that much space
        return title
    }

    render(): JSX.Element {
        const { targetX: x, targetY: y } = this.props
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
                    {title.render(x, y, {
                        fill: GRAPHER_DARK_TEXT,
                    })}
                </a>
                {subtitle.renderSVG(
                    x,
                    y + title.height + this.subtitleMarginTop,
                    {
                        fill: GRAPHER_DARK_TEXT,
                    }
                )}
            </g>
        )
    }
}
