import React from "react"
import {
    TextWrap,
    DEFAULT_BOUNDS,
    MarkdownTextWrap,
    getFontScale,
} from "@ourworldindata/utils"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Logo } from "../captionedChart/Logos"
import { HeaderManager } from "./HeaderManager"
import { BASE_FONT_SIZE, SizeVariant } from "../core/GrapherConstants"

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

    @computed protected get sizeVariant(): SizeVariant {
        return this.manager.sizeVariant ?? SizeVariant.lg
    }

    @computed protected get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_BOUNDS.width
    }

    @computed private get titleText(): string {
        return this.manager.currentTitle ?? ""
    }

    @computed private get subtitleText(): string {
        return this.manager.subtitle ?? ""
    }

    @computed get logo(): Logo | undefined {
        const { manager, sizeVariant } = this
        if (manager.hideLogo) return undefined

        const heightScale = sizeVariant === SizeVariant.xs ? 0.775 : 1
        return new Logo({
            logo: manager.logo as any,
            isLink: !!manager.shouldLinkToOwid,
            heightScale,
        })
    }

    @computed private get logoWidth(): number {
        return this.logo ? this.logo.width : 0
    }

    @computed private get logoHeight(): number {
        return this.logo ? this.logo.height : 0
    }

    @computed get title(): TextWrap {
        const { logoWidth, sizeVariant } = this
        const fontScale =
            sizeVariant === SizeVariant.xs
                ? getFontScale(18)
                : sizeVariant === SizeVariant.sm
                ? getFontScale(20)
                : getFontScale(24)
        return new TextWrap({
            maxWidth: this.maxWidth - logoWidth - 24,
            fontWeight: 400,
            lineHeight: sizeVariant === SizeVariant.xs ? 1.1 : 1.2,
            fontSize: fontScale * this.fontSize,
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
        const { sizeVariant } = this
        const fontScale =
            sizeVariant === SizeVariant.xs
                ? getFontScale(12)
                : sizeVariant === SizeVariant.sm
                ? getFontScale(13)
                : getFontScale(14)
        const lineHeight =
            sizeVariant === SizeVariant.md || sizeVariant === SizeVariant.lg
                ? 1.28571
                : 1.2
        return new MarkdownTextWrap({
            maxWidth: this.subtitleWidth,
            fontSize: fontScale * this.fontSize,
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
                <div style={{ minHeight: this.height }}>
                    <a
                        href={manager.canonicalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <h1 style={this.title.htmlStyle}>
                            {this.title.renderHTML()}
                        </h1>
                    </a>
                    {this.subtitleText && (
                        <p style={subtitleStyle}>
                            {this.subtitle.renderHTML()}
                        </p>
                    )}
                </div>
            </div>
        )
    }
}
