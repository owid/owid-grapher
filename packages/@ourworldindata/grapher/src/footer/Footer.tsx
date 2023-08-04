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
const PADDING_BELOW_NOTE = 4
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
            ? `Data source: ${sourcesLine} – Learn more about this data`
            : ""
    }

    @computed protected get noteText(): string {
        return this.manager.note ? `**Note:** ${this.manager.note}` : ""
    }

    @computed protected get ccSvg(): string {
        if (this.manager.hasOWIDLogo) {
            // dash in CC-BY prevents break but is not rendered
            return `<a class="cclogo" href="http://creativecommons.org/licenses/by/4.0/deed.en_US" target="_blank">CC-BY</a>`
        }

        return `<a href="https://ourworldindata.org" target="_blank">Powered by ourworldindata.org</a>`
    }

    @computed private get originUrlWithProtocol(): string {
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
        // And don't show the full url if there isn't enough room
        if (!originUrl || !originUrl.toLowerCase().match(/^https?:\/\/./))
            return undefined

        const url = parseUrl(originUrl)
        const finalUrlText = `${url.hostname}${url.pathname}`
            .replace("ourworldindata.org", "OurWorldInData.org")
            .replace(/\/$/, "") // remove trailing slash

        if (
            Bounds.forText(finalUrlText, { fontSize: this.fontSize }).width >
            0.7 * this.maxWidth
        )
            return undefined

        return finalUrlText
    }

    @computed protected get licenseAndOriginUrlSvg(): string {
        const { finalUrl, finalUrlText, ccSvg } = this
        if (!finalUrlText) return ccSvg

        // trick to allow for line breaks after "/" and "-"
        const finalUrlTextWithSpaces = finalUrlText
            .replace(/\//g, "/ ")
            .replace(/-/g, "- ")

        const originUrlLink = `<a target='_blank' href='${finalUrl}'> ${finalUrlTextWithSpaces} </a>`
        return [originUrlLink, ccSvg].join(" | ")
    }

    @computed protected get fontSize(): number {
        return 0.6875 * (this.manager.fontSize ?? BASE_FONT_SIZE) // 11px when base font size = 16px
    }

    @computed private get sourcesFontSize(): number {
        return 0.8125 * (this.manager.fontSize ?? BASE_FONT_SIZE) // 13px when base font size = 16px
    }

    @computed protected get sources(): MarkdownTextWrap {
        const { maxWidth, sourcesFontSize, sourcesText } = this
        return new MarkdownTextWrap({
            maxWidth: maxWidth - this.actionButtons.width - HORIZONTAL_PADDING,
            fontSize: sourcesFontSize,
            text: sourcesText,
            lineHeight: 1.2,
        })
    }

    @computed protected get note(): MarkdownTextWrap {
        const { maxWidth, fontSize, noteText } = this
        return new MarkdownTextWrap({
            maxWidth:
                maxWidth - this.licenseAndOriginUrl.width - HORIZONTAL_PADDING,
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
        const { maxWidth, fontSize, noteText, licenseAndOriginUrlSvg } = this

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
            text: licenseAndOriginUrlSvg,
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
            licenseAndOriginUrlSvg,
            licenseAndOriginUrlMaxWidth,
        } = this
        return new TextWrap({
            maxWidth: licenseAndOriginUrlMaxWidth,
            fontSize,
            text: licenseAndOriginUrlSvg,
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
            PADDING_BELOW_NOTE +
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
                {this.manager.hasOWIDLogo ? (
                    <a
                        className="cclogo"
                        href="http://creativecommons.org/licenses/by/4.0/deed.en_US"
                        target="_blank"
                        rel="noopener"
                        style={{ textDecoration: "none" }}
                    >
                        CC BY
                    </a>
                ) : (
                    <a
                        href="https://ourworldindata.org"
                        target="_blank"
                        rel="noopener"
                        style={{ textDecoration: "none" }}
                    >
                        Powered by ourworldindata.org
                    </a>
                )}
            </div>
        )

        return (
            <footer className="SourcesFooterHTML" ref={this.base}>
                <div
                    className="NoteAndLicense"
                    style={{
                        minHeight: this.licenseAndOriginUrl.height,
                        marginBottom: PADDING_BELOW_NOTE,
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
    constructor(props: StaticFooterProps) {
        super(props)
    }

    @computed protected get ccSvg(): string {
        if (this.manager.hasOWIDLogo) {
            return `<a class="cclogo" href="http://creativecommons.org/licenses/by/4.0/deed.en_US" target="_blank">CC BY</a>`
        }

        return `<a href="https://ourworldindata.org" target="_blank">Powered by ourworldindata.org</a>`
    }

    @computed protected get licenseAndOriginUrlSvg(): string {
        const { finalUrl, finalUrlText, ccSvg } = this
        if (!finalUrlText) return ccSvg
        const originUrlLink = `<a target='_blank' href='${finalUrl}'>${finalUrl}</a>`
        return [originUrlLink, ccSvg].join(" | ")
    }

    @computed protected get sources(): MarkdownTextWrap {
        const { maxWidth, fontSize, sourcesText } = this
        return new MarkdownTextWrap({
            maxWidth,
            fontSize,
            text: sourcesText,
            lineHeight: 1.2,
        })
    }

    @computed protected get note(): MarkdownTextWrap {
        const { maxWidth, fontSize, noteText } = this
        return new MarkdownTextWrap({
            maxWidth,
            fontSize,
            text: noteText,
            lineHeight: 1.2,
            detailsOrderedByReference: this.manager
                .shouldIncludeDetailsInStaticExport
                ? this.manager.detailsOrderedByReference
                : new Set(),
        })
    }

    @computed protected get licenseAndOriginUrl(): TextWrap {
        const { maxWidth, fontSize, licenseAndOriginUrlSvg } = this
        return new TextWrap({
            maxWidth: maxWidth * 3,
            fontSize,
            text: licenseAndOriginUrlSvg,
            rawHtml: true,
        })
    }

    @computed protected get isCompact(): boolean {
        return (
            this.maxWidth - this.sources.width - 5 >
            this.licenseAndOriginUrl.width
        )
    }

    render(): JSX.Element {
        const { sources, note, licenseAndOriginUrl, maxWidth, isCompact } = this
        const { targetX, targetY } = this.props
        const paraMargin = 4

        return (
            <g className="SourcesFooter" style={{ fill: "#5B5B5B" }}>
                <g style={{ fill: "#5B5B5B" }}>
                    {sources.renderSVG(targetX, targetY)}
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
}
