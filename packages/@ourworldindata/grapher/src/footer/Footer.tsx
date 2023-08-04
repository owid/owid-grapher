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
import {
    BASE_FONT_SIZE,
    GrapherTabOverlayOption,
} from "../core/GrapherConstants"
import { FooterManager } from "./FooterManager"
import { ActionButtons } from "../controls/ActionButtons"

const PADDING_ABOVE_CONTROLS = 16
const HORIZONTAL_PADDING = 16

interface FooterProps {
    manager: FooterManager
    maxWidth?: number
}

@observer
export class Footer<
    Props extends FooterProps = FooterProps
> extends React.Component<Props> {
    @computed protected get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_BOUNDS.width
    }

    @computed protected get manager(): FooterManager {
        return this.props.manager
    }

    @computed protected get sourcesText(): string {
        const sourcesLine = this.manager.sourcesLine
        return sourcesLine
            ? `**Data source:** ${sourcesLine} – Learn more about this data`
            : ""
    }

    @computed protected get noteText(): string {
        return this.manager.note ? `**Note:** ${this.manager.note}` : ""
    }

    @computed protected get licenseText(): string {
        if (this.manager.hasOWIDLogo) return "CC BY"
        return "Powered by ourworldindata.org"
    }

    @computed protected get licenseUrl(): string {
        if (this.manager.hasOWIDLogo)
            return "http://creativecommons.org/licenses/by/4.0/deed.en_US"
        return "https://ourworldindata.org"
    }

    @computed protected get originUrlWithProtocol(): string {
        return this.manager.originUrlWithProtocol ?? "http://localhost"
    }

    @computed protected get finalUrl(): string {
        const originUrl = this.originUrlWithProtocol
        const url = parseUrl(originUrl)
        return `https://${url.hostname}${url.pathname}`
    }

    @computed protected get finalUrlText(): string | undefined {
        const originUrl = this.originUrlWithProtocol

        // Make sure the link back to OWID is consistent
        if (!originUrl || !originUrl.toLowerCase().match(/^https?:\/\/./))
            return undefined

        const url = parseUrl(originUrl)
        const finalUrlText = `${url.hostname}${url.pathname}`
            .replace("ourworldindata.org", "OurWorldInData.org")
            .replace(/\/$/, "") // remove trailing slash

        return finalUrlText
    }

    @computed protected get licenseAndOriginUrlText(): string {
        const { finalUrlText, licenseText } = this
        if (!finalUrlText) return licenseText

        // trick to allow for line breaks after "/" and "-"
        const finalUrlTextWithSpaces = finalUrlText
            .replace(/\//g, "/ ")
            .replace(/-/g, "- ")

        return [finalUrlTextWithSpaces, licenseText].join(" | ")
    }

    @computed protected get fontSize(): number {
        return 0.6875 * (this.manager.fontSize ?? BASE_FONT_SIZE) // 11px when base font size = 16px
    }

    @computed protected get sourcesFontSize(): number {
        return 0.8125 * (this.manager.fontSize ?? BASE_FONT_SIZE) // 13px when base font size = 16px
    }

    @computed protected get sourcesMaxWidth(): number {
        return this.maxWidth - this.actionButtons.width - HORIZONTAL_PADDING
    }

    @computed protected get sources(): MarkdownTextWrap {
        const { sourcesFontSize, sourcesText, sourcesMaxWidth } = this
        return new MarkdownTextWrap({
            maxWidth: sourcesMaxWidth,
            fontSize: sourcesFontSize,
            text: sourcesText,
            lineHeight: 1.2,
        })
    }

    @computed protected get noteMaxWidth(): number {
        return (
            this.maxWidth - this.licenseAndOriginUrl.width - HORIZONTAL_PADDING
        )
    }

    @computed protected get note(): MarkdownTextWrap {
        const { fontSize, noteText, noteMaxWidth } = this
        return new MarkdownTextWrap({
            maxWidth: noteMaxWidth,
            fontSize,
            text: noteText,
            lineHeight: 1.2,
            detailsOrderedByReference: this.manager
                .shouldIncludeDetailsInStaticExport
                ? this.manager.detailsOrderedByReference
                : new Set(),
        })
    }

    @computed protected get licenseAndOriginUrlMaxWidth(): number {
        const { maxWidth, fontSize, noteText, licenseAndOriginUrlText } = this

        // use full width if there is no note
        if (!noteText) return maxWidth

        const noteWidth = new MarkdownTextWrap({
            maxWidth: Infinity, // no line breaks
            fontSize,
            text: noteText,
        }).width
        const licenseAndOriginUrlWidth = new TextWrap({
            maxWidth: Infinity, // no line breaks
            fontSize,
            text: licenseAndOriginUrlText,
            rawHtml: true,
        }).width

        // note and licenseAndOriginUrl fit into a single line
        if (
            noteWidth + HORIZONTAL_PADDING + licenseAndOriginUrlWidth <=
            maxWidth
        ) {
            return maxWidth
        }

        return 0.33 * maxWidth
    }

    @computed protected get licenseAndOriginUrl(): TextWrap {
        const {
            fontSize,
            licenseAndOriginUrlText,
            licenseAndOriginUrlMaxWidth,
        } = this
        return new TextWrap({
            maxWidth: licenseAndOriginUrlMaxWidth,
            fontSize,
            text: licenseAndOriginUrlText,
            lineHeight: 1.2,
            rawHtml: true,
        })
    }

    @computed private get availableWidthActionButtons(): number {
        const { sourcesFontSize, sourcesText, maxWidth } = this
        const sourcesWidth = new MarkdownTextWrap({
            maxWidth: Infinity, // no line breaks
            fontSize: sourcesFontSize,
            text: sourcesText,
        }).width
        return maxWidth - sourcesWidth - HORIZONTAL_PADDING
    }

    @computed private get actionButtons(): ActionButtons {
        return new ActionButtons({
            manager: this.manager,
            maxWidth: this.maxWidth,
            availableWidth: this.availableWidthActionButtons,
        })
    }

    @computed get height(): number {
        const { sources, note, licenseAndOriginUrl, actionButtons } = this
        const height =
            Math.max(note.height, licenseAndOriginUrl.height) +
            PADDING_ABOVE_CONTROLS +
            Math.max(sources.height, actionButtons.height)
        return height
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
                    width: this.licenseAndOriginUrl.width,
                }}
            >
                {this.finalUrlText && (
                    <a
                        href={this.finalUrl}
                        target="_blank"
                        rel="noopener"
                        style={{ textDecoration: "none" }}
                    >
                        {this.finalUrlText} |{" "}
                    </a>
                )}
                <a
                    className={this.manager.hasOWIDLogo ? "cclogo" : undefined}
                    href={this.licenseUrl}
                    target="_blank"
                    rel="noopener"
                    style={{ textDecoration: "none" }}
                >
                    {this.licenseText}
                </a>
            </div>
        )

        return (
            <footer className="SourcesFooterHTML" ref={this.base}>
                <div
                    className="NoteAndLicense"
                    style={{
                        minHeight: this.licenseAndOriginUrl.height,
                    }}
                >
                    <p className="note" style={this.note.style}>
                        {this.note.renderHTML()}
                    </p>
                    {license}
                </div>
                <div
                    className="SourcesAndActionButtons"
                    style={{
                        marginTop: PADDING_ABOVE_CONTROLS,
                        alignItems:
                            this.sources.htmlLines.length > 2
                                ? "flex-end"
                                : "center",
                    }}
                >
                    <p
                        style={{
                            ...this.sources.style,
                            maxWidth: this.sources.maxWidth,
                        }}
                    >
                        <b>Data source:</b> {this.manager.sourcesLine} –{" "}
                        <a
                            className="sources"
                            data-track-note="chart_click_sources"
                            onClick={(): void => {
                                this.manager.currentTab =
                                    GrapherTabOverlayOption.sources
                            }}
                        >
                            Learn more about this data
                        </a>
                    </p>
                    <ActionButtons
                        manager={this.manager}
                        maxWidth={this.maxWidth}
                        availableWidth={this.availableWidthActionButtons}
                    />
                </div>
                {tooltipTarget && (
                    <Tooltip
                        id="footer"
                        tooltipManager={this.manager}
                        x={tooltipTarget.x}
                        y={tooltipTarget.y}
                        style={{
                            textAlign: "left",
                            maxWidth: "304px",
                            whiteSpace: "inherit",
                            fontSize: "14px",
                            padding: "0",
                            lineHeight: "21px",
                            fontWeight: 400,
                            letterSpacing: "0.01em",
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

interface StaticFooterProps extends FooterProps {
    targetX: number
    targetY: number
}

@observer
export class StaticFooter extends Footer<StaticFooterProps> {
    private paraMargin = 4
    private sourceMargin = this.paraMargin * 2

    @computed protected get finalUrlText(): string | undefined {
        const originUrl = this.originUrlWithProtocol

        // Make sure the link back to OWID is consistent
        if (!originUrl || !originUrl.toLowerCase().match(/^https?:\/\/./))
            return undefined

        const url = parseUrl(originUrl)
        const finalUrlText = `${url.hostname}${url.pathname}`
            .replace("ourworldindata.org", "OurWorldInData.org")
            .replace(/\/$/, "") // remove trailing slash

        // If the URL is too long, don't show it
        if (
            Bounds.forText(finalUrlText, { fontSize: this.fontSize }).width >
            0.7 * this.maxWidth
        )
            return undefined

        return finalUrlText
    }

    @computed protected get licenseAndOriginUrlText(): string {
        const { finalUrl, finalUrlText, licenseText, licenseUrl } = this
        const licenseSvg = `<a target="_blank" style='fill: #5b5b5b;' href="${licenseUrl}">${licenseText}</a>`
        if (!finalUrlText) return licenseSvg
        const originUrlSvg = `<a target="_blank" href="${finalUrl}">${finalUrlText}</a>`
        return [originUrlSvg, licenseSvg].join(" | ")
    }

    @computed protected get sourcesText(): string {
        const sourcesLine = this.manager.sourcesLine
        return sourcesLine ? `**Data source:** ${sourcesLine}` : ""
    }

    @computed protected get sourcesMaxWidth(): number {
        return this.maxWidth
    }

    @computed protected get noteMaxWidth(): number {
        const { maxWidth, isCompact, licenseAndOriginUrl } = this
        return isCompact ? maxWidth - licenseAndOriginUrl.width - 8 : maxWidth
    }

    @computed protected get licenseAndOriginUrlMaxWidth(): number {
        return Infinity // no line breaks
    }

    @computed protected get isCompact(): boolean {
        const { maxWidth, licenseAndOriginUrl, noteText } = this
        if (!noteText) return true
        return licenseAndOriginUrl.width < 0.33 * maxWidth
    }

    @computed get height(): number {
        const { sources, note, isCompact, licenseAndOriginUrl } = this
        return (
            sources.height +
            this.sourceMargin +
            Math.max(note.height, licenseAndOriginUrl.height) +
            (isCompact ? 0 : licenseAndOriginUrl.height + this.paraMargin)
        )
    }

    render(): JSX.Element {
        const { sources, note, licenseAndOriginUrl, maxWidth, isCompact } = this
        const { targetX, targetY } = this.props

        return (
            <g className="SourcesFooter" style={{ fill: "#5b5b5b" }}>
                {note.renderSVG(targetX, targetY)}
                {sources.renderSVG(
                    targetX,
                    targetY +
                        Math.max(note.height, licenseAndOriginUrl.height) +
                        this.sourceMargin +
                        (isCompact
                            ? 0
                            : licenseAndOriginUrl.height + this.paraMargin)
                )}
                {isCompact
                    ? licenseAndOriginUrl.render(
                          targetX + maxWidth - licenseAndOriginUrl.width,
                          targetY
                      )
                    : licenseAndOriginUrl.render(
                          targetX,
                          targetY + note.height + this.paraMargin
                      )}
            </g>
        )
    }
}
