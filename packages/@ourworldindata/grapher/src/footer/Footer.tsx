import React from "react"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import parseUrl from "url-parse"
import {
    TextWrap,
    Bounds,
    DEFAULT_BOUNDS,
    getFontScale,
    getRelativeMouse,
    MarkdownTextWrap,
} from "@ourworldindata/utils"
import { Tooltip } from "../tooltip/Tooltip"
import { BASE_FONT_SIZE, SizeVariant } from "../core/GrapherConstants"
import { FooterManager } from "./FooterManager"
import { ActionButtons } from "../controls/ActionButtons"

// keep in sync with sass variables in Footer.scss
const LICENSE_PADDING_TOP = 4
const HORIZONTAL_PADDING = 16

interface TextStyle {
    fontSize: number
    lineHeight?: number
}

interface FooterProps {
    manager: FooterManager
    maxWidth?: number
}

@observer
export class Footer<
    Props extends FooterProps = FooterProps
> extends React.Component<Props> {
    @computed protected get manager(): FooterManager {
        return this.props.manager
    }

    @computed protected get sizeVariant(): SizeVariant {
        return this.manager.sizeVariant ?? SizeVariant.lg
    }

    @computed protected get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_BOUNDS.width
    }

    // todo(redesign): refactor
    @computed protected get notePaddingTop(): number {
        return 4
    }

    @computed protected get sourcesText(): string {
        const sourcesLine = this.manager.sourcesLine
        return sourcesLine
            ? `Data source: ${sourcesLine} - Learn more about this data`
            : ""
    }

    @computed protected get noteText(): string {
        return this.manager.note ? `Note: ${this.manager.note}` : ""
    }

    @computed protected get markdownNoteText(): string {
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

    @computed protected get correctedUrlText(): string | undefined {
        const originUrl = this.originUrlWithProtocol

        // Make sure the link back to OWID is consistent
        if (!originUrl || !originUrl.toLowerCase().match(/^https?:\/\/./))
            return undefined

        const url = parseUrl(originUrl)
        return `${url.hostname}${url.pathname}`
            .replace("ourworldindata.org", "OurWorldInData.org")
            .replace(/\/$/, "") // remove trailing slash
    }

    protected static constructLicenseAndOriginUrlText(
        urlText: string | undefined,
        licenseText: string
    ): string {
        if (!urlText) return licenseText
        return [urlText, licenseText].join(" | ")
    }

    @computed protected get finalUrlText(): string | undefined {
        const {
            correctedUrlText,
            licenseText,
            textStyle,
            maxWidth,
            actionButtons,
        } = this

        if (!correctedUrlText) return undefined

        const licenseAndOriginUrlText = Footer.constructLicenseAndOriginUrlText(
            correctedUrlText,
            licenseText
        )
        const licenseAndOriginUrlWidth = Bounds.forText(
            licenseAndOriginUrlText,
            textStyle
        ).width

        // If the URL is too long, don't show it
        if (
            licenseAndOriginUrlWidth + HORIZONTAL_PADDING >
            maxWidth - actionButtons.width
        )
            return undefined

        return correctedUrlText
    }

    @computed protected get licenseAndOriginUrlText(): string {
        const { finalUrlText, licenseText } = this
        return Footer.constructLicenseAndOriginUrlText(
            finalUrlText,
            licenseText
        )
    }

    @computed protected get textStyle(): TextStyle {
        const fontScale =
            this.sizeVariant === SizeVariant.xs ||
            this.sizeVariant === SizeVariant.sm
                ? getFontScale(11)
                : getFontScale(12)
        const fontSize = fontScale * (this.manager.fontSize ?? BASE_FONT_SIZE)
        const lineHeight = this.sizeVariant === SizeVariant.xs ? 1.1 : 1.2
        return {
            fontSize,
            lineHeight,
        }
    }

    @computed private get hasNote(): boolean {
        return !!this.noteText
    }

    @computed protected get sourcesStyle(): TextStyle {
        const fontScale =
            this.sizeVariant === SizeVariant.xs
                ? getFontScale(12)
                : getFontScale(13)
        const fontSize = fontScale * (this.manager.fontSize ?? BASE_FONT_SIZE)
        const lineHeight = this.sizeVariant === SizeVariant.xs ? 1.1 : 1.2
        return {
            fontSize,
            lineHeight,
        }
    }

    @computed protected get noteMaxWidth(): number {
        return this.maxWidth - this.actionButtons.width - HORIZONTAL_PADDING
    }

    @computed protected get sourcesMaxWidth(): number {
        return this.hasNote
            ? this.maxWidth
            : this.maxWidth - this.actionButtons.width - HORIZONTAL_PADDING
    }

    @computed protected get sources(): MarkdownTextWrap {
        const { sourcesText, sourcesStyle, sourcesMaxWidth } = this
        return new MarkdownTextWrap({
            ...sourcesStyle,
            maxWidth: sourcesMaxWidth,
            text: sourcesText,
        })
    }

    @computed protected get note(): MarkdownTextWrap {
        const { markdownNoteText, noteMaxWidth, textStyle } = this
        return new MarkdownTextWrap({
            ...textStyle,
            maxWidth: noteMaxWidth,
            text: markdownNoteText,
            detailsOrderedByReference: this.manager
                .shouldIncludeDetailsInStaticExport
                ? this.manager.detailsOrderedByReference
                : new Set(),
        })
    }

    @computed protected get licenseAndOriginUrlMaxWidth(): number {
        return this.maxWidth
    }

    @computed protected get licenseAndOriginUrl(): TextWrap {
        const {
            licenseAndOriginUrlText,
            licenseAndOriginUrlMaxWidth,
            textStyle,
        } = this
        return new TextWrap({
            ...textStyle,
            maxWidth: licenseAndOriginUrlMaxWidth,
            text: licenseAndOriginUrlText,
            rawHtml: true,
        })
    }

    @computed private get availableWidthActionButtons(): number {
        const {
            noteText,
            correctedUrlText,
            licenseText,
            maxWidth,
            textStyle,
            sourcesStyle,
            sourcesText,
            hasNote,
        } = this
        const textWidth = hasNote
            ? Bounds.forText(noteText, textStyle).width
            : Bounds.forText(sourcesText, sourcesStyle).width
        const licenseAndOriginUrlWidth = Bounds.forText(
            Footer.constructLicenseAndOriginUrlText(
                correctedUrlText,
                licenseText
            ),
            textStyle
        ).width
        return (
            maxWidth -
            Math.max(textWidth, licenseAndOriginUrlWidth) -
            HORIZONTAL_PADDING
        )
    }

    @computed private get actionButtons(): ActionButtons {
        return new ActionButtons({
            manager: this.manager,
            maxWidth: this.maxWidth,
            availableWidth: this.availableWidthActionButtons,
        })
    }

    @computed get height(): number {
        const {
            sources,
            note,
            licenseAndOriginUrl,
            actionButtons,
            notePaddingTop,
            hasNote,
        } = this
        const height =
            (hasNote ? sources.height + notePaddingTop : 0) +
            Math.max(
                (hasNote ? note.height : sources.height) +
                    LICENSE_PADDING_TOP +
                    licenseAndOriginUrl.height,
                actionButtons.height
            )
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
            <div className="license" style={this.licenseAndOriginUrl.htmlStyle}>
                {this.finalUrlText && (
                    <a href={this.finalUrl} target="_blank" rel="noopener">
                        {this.finalUrlText}
                    </a>
                )}{" "}
                |{" "}
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

        const sources = (
            <p className="sources" style={this.sources.style}>
                <b>Data source:</b> {this.manager.sourcesLine} -{" "}
                <a
                    data-track-note="chart_click_sources"
                    onClick={action(
                        () => (this.manager.isSourcesModalOpen = true)
                    )}
                >
                    Learn more about this data
                </a>
            </p>
        )

        const note = (
            <p className="note" style={this.note.style}>
                {this.note.renderHTML()}
            </p>
        )

        return (
            <footer className="SourcesFooterHTML" ref={this.base}>
                {this.hasNote && sources}
                <div
                    className="NoteAndActionButtons"
                    style={{
                        marginTop: this.hasNote ? this.notePaddingTop : 0,
                    }}
                >
                    <div>
                        {this.hasNote ? note : sources}
                        {license}
                    </div>
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

    // Put the license stuff to the side if there's room
    @computed private get isCompact(): boolean {
        return (
            this.maxWidth - this.sources.width - 8 >
            this.licenseAndOriginUrl.width
        )
    }

    @computed protected get finalUrlText(): string | undefined {
        const { correctedUrlText, licenseText, textStyle, maxWidth } = this

        if (!correctedUrlText) return undefined

        const licenseAndOriginUrlText = Footer.constructLicenseAndOriginUrlText(
            correctedUrlText,
            licenseText
        )
        const licenseAndOriginUrlWidth = Bounds.forText(
            licenseAndOriginUrlText,
            textStyle
        ).width

        // If the URL is too long, don't show it
        if (licenseAndOriginUrlWidth > maxWidth) return undefined

        return correctedUrlText
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

    @computed protected get sourcesStyle(): TextStyle {
        return this.textStyle
    }

    @computed protected get sourcesMaxWidth(): number {
        return this.maxWidth
    }

    @computed protected get noteMaxWidth(): number {
        return this.maxWidth
    }

    @computed protected get licenseAndOriginUrlMaxWidth(): number {
        return this.maxWidth
    }

    @computed get height(): number {
        return (
            this.sources.height +
            (this.note.height ? this.note.height + this.paraMargin : 0) +
            (this.isCompact
                ? 0
                : this.licenseAndOriginUrl.height + this.paraMargin)
        )
    }

    render(): JSX.Element {
        const {
            sources,
            note,
            licenseAndOriginUrl,
            isCompact,
            maxWidth,
            paraMargin,
        } = this
        const { targetX, targetY } = this.props

        return (
            <g className="SourcesFooter" style={{ fill: "#5b5b5b" }}>
                {sources.renderSVG(targetX, targetY)}
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
                              (note.height ? note.height + paraMargin : 0) +
                              paraMargin
                      )}
            </g>
        )
    }
}
