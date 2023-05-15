import React from "react"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import parseUrl from "url-parse"
import {
    TextWrap,
    Bounds,
    DEFAULT_BOUNDS,
    getRelativeMouse,
    MarkdownTextWrap,
} from "@ourworldindata/utils"
import { Tooltip } from "../tooltip/Tooltip"
import { BASE_FONT_SIZE } from "../core/GrapherConstants"
import { FooterManager } from "./FooterManager"

@observer
export class Footer extends React.Component<{
    manager: FooterManager
    maxWidth?: number
}> {
    @computed private get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_BOUNDS.width
    }

    @computed private get manager(): FooterManager {
        return this.props.manager
    }

    @computed private get sourcesText(): string {
        const sourcesLine = this.manager.sourcesLine
        return sourcesLine ? `Source: ${sourcesLine}` : ""
    }

    @computed private get noteText(): string {
        return this.manager.note ? `Note: ${this.manager.note}` : ""
    }

    @computed private get ccSvg(): string {
        if (this.manager.hasOWIDLogo)
            return `<a style="fill: #777;" class="cclogo" href="http://creativecommons.org/licenses/by/4.0/deed.en_US" target="_blank">CC BY</a>`

        return `<a href="https://ourworldindata.org" target="_blank">Powered by ourworldindata.org</a>`
    }

    @computed private get originUrlWithProtocol(): string {
        return this.manager.originUrlWithProtocol ?? "http://localhost"
    }

    @computed private get finalUrl(): string {
        const originUrl = this.originUrlWithProtocol
        const url = parseUrl(originUrl)
        return `https://${url.hostname}${url.pathname}`
    }

    @computed private get finalUrlText(): string | undefined {
        const originUrl = this.originUrlWithProtocol

        // Make sure the link back to OWID is consistent
        // And don't show the full url if there isn't enough room
        if (!originUrl || !originUrl.toLowerCase().match(/^https?:\/\/./))
            return undefined

        const url = parseUrl(originUrl)
        const finalUrlText = `${url.hostname}${url.pathname}`.replace(
            "ourworldindata.org",
            "OurWorldInData.org"
        )
        if (
            Bounds.forText(finalUrlText, { fontSize: this.fontSize }).width >
            0.7 * this.maxWidth
        )
            return undefined
        return finalUrlText
    }

    @computed private get licenseAndOriginUrlSvg(): string {
        const { finalUrl, finalUrlText, ccSvg } = this
        if (!finalUrlText) return ccSvg

        const originUrlLink = `<a target='_blank' style='fill: #777;' href='${finalUrl}'>${finalUrlText}</a>`
        return [originUrlLink, ccSvg].join(" • ")
    }

    @computed private get fontSize(): number {
        return 0.7 * (this.manager.fontSize ?? BASE_FONT_SIZE)
    }

    @computed private get sources(): TextWrap {
        const { maxWidth, fontSize, sourcesText } = this
        return new TextWrap({
            maxWidth,
            fontSize,
            text: sourcesText,
            linkifyText: true,
        })
    }

    @computed private get note(): MarkdownTextWrap {
        const { maxWidth, fontSize, noteText } = this
        return new MarkdownTextWrap({
            maxWidth,
            fontSize,
            text: noteText,
            detailsOrderedByReference: this.manager
                .shouldIncludeDetailsInStaticExport
                ? this.manager.detailsOrderedByReference
                : new Set(),
        })
    }

    @computed private get licenseAndOriginUrl(): TextWrap {
        const { maxWidth, fontSize, licenseAndOriginUrlSvg } = this
        return new TextWrap({
            maxWidth: maxWidth * 3,
            fontSize,
            text: licenseAndOriginUrlSvg,
            rawHtml: true,
        })
    }

    // Put the license stuff to the side if there's room
    @computed private get isCompact(): boolean {
        return (
            this.maxWidth - this.sources.width - 5 >
            this.licenseAndOriginUrl.width
        )
    }

    @computed private get paraMargin(): number {
        return 2
    }

    @computed get height(): number {
        if (this.manager.isMediaCard) return 0

        const { sources, note, licenseAndOriginUrl, isCompact, paraMargin } =
            this
        return (
            sources.height +
            (note.height ? paraMargin + note.height : 0) +
            (isCompact ? 0 : paraMargin + licenseAndOriginUrl.height)
        )
    }

    renderStatic(targetX: number, targetY: number): JSX.Element | null {
        if (this.manager.isMediaCard) return null

        const {
            sources,
            note,
            licenseAndOriginUrl,
            maxWidth,
            isCompact,
            paraMargin,
        } = this

        return (
            <g className="SourcesFooter" style={{ fill: "#777" }}>
                <g style={{ fill: "#777" }}>
                    {sources.render(targetX, targetY)}
                </g>
                {note.renderSVG(targetX, targetY + sources.height + paraMargin)}
                {isCompact
                    ? licenseAndOriginUrl.render(
                          targetX + maxWidth - licenseAndOriginUrl.width,
                          targetY
                      )
                    : licenseAndOriginUrl.render(
                          targetX,
                          targetY +
                              sources.height +
                              paraMargin +
                              (note.height ? note.height + paraMargin : 0)
                      )}
            </g>
        )
    }

    base: React.RefObject<HTMLDivElement> = React.createRef()
    @observable.ref tooltipTarget?: { x: number; y: number }

    @action.bound private onMouseMove(e: MouseEvent): void {
        const cc = this.base.current!.querySelector(".cclogo")
        if (cc && cc.matches(":hover")) {
            const div = this.base.current as HTMLDivElement
            const grapher = div.closest(".GrapherComponent")
            if (grapher) {
                const mouse = getRelativeMouse(grapher, e)
                this.tooltipTarget = { x: mouse.x, y: mouse.y }
            } else console.error("Grapher was falsy")
        } else this.tooltipTarget = undefined
    }

    componentDidMount(): void {
        window.addEventListener("mousemove", this.onMouseMove)
    }

    componentWillUnmount(): void {
        window.removeEventListener("mousemove", this.onMouseMove)
    }

    render(): JSX.Element {
        const { tooltipTarget } = this

        const license = (
            <div
                className="license"
                style={{
                    fontSize: this.licenseAndOriginUrl.fontSize,
                    lineHeight: this.sources.lineHeight,
                }}
            >
                {this.finalUrlText && (
                    <a href={this.finalUrl} target="_blank" rel="noopener">
                        {this.finalUrlText} •{" "}
                    </a>
                )}
                {this.manager.hasOWIDLogo ? (
                    <a
                        className="cclogo"
                        href="http://creativecommons.org/licenses/by/4.0/deed.en_US"
                        target="_blank"
                        rel="noopener"
                    >
                        CC BY
                    </a>
                ) : (
                    <a
                        href="https://ourworldindata.org"
                        target="_blank"
                        rel="noopener"
                    >
                        Powered by ourworldindata.org
                    </a>
                )}
            </div>
        )

        return (
            <footer
                className={
                    "SourcesFooterHTML" + (this.isCompact ? " compact" : "")
                }
                ref={this.base}
                style={{ color: "#777" }}
            >
                {this.isCompact && license}
                <p style={this.sources.htmlStyle}>
                    {this.sources.renderHTML()}
                </p>
                {this.note && (
                    <p style={this.note.style}>{this.note.renderHTML()}</p>
                )}
                {!this.isCompact && license}
                {tooltipTarget && (
                    <Tooltip
                        id="footer"
                        tooltipManager={this.manager}
                        x={tooltipTarget.x}
                        y={tooltipTarget.y}
                        style={{
                            textAlign: "center",
                            maxWidth: "300px",
                            whiteSpace: "inherit",
                            padding: "10px",
                            fontSize: "0.8em",
                        }}
                    >
                        <p>
                            Our World in Data charts are licensed under Creative
                            Commons; you are free to use, share, and adapt this
                            material. Click through to the CC BY page for more
                            information. Please bear in mind that the underlying
                            source data for all our charts might be subject to
                            different license terms from third-party authors.
                        </p>
                    </Tooltip>
                )}
            </footer>
        )
    }
}
