import React from "react"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import parseUrl from "url-parse"
import { Bounds, DEFAULT_BOUNDS, getRelativeMouse } from "@ourworldindata/utils"
import {
    DATAPAGE_ABOUT_THIS_DATA_SECTION_ID,
    MarkdownTextWrap,
    TextWrap,
} from "@ourworldindata/components"
import { Tooltip } from "../tooltip/Tooltip"
import { FooterManager } from "./FooterManager"
import { ActionButtons } from "../controls/ActionButtons"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_FRAME_PADDING,
    GRAPHER_DARK_TEXT,
} from "../core/GrapherConstants"

/*

The footer contains the sources, the note (optional), the action buttons and the license and origin URL (optional).

If all elements exist, they are laid out as follows:
+-------------------------------------------------------+
|  Sources                                              |
+------------------------------------+------------------+
|  Note                              |                  |
+------------------------------------+  Action buttons  |
|  Origin URL | CC BY                |                  |
+-------------------------------------------------------+

If the note is long, it is placed below the sources:
+-------------------------------------------------------+
|  Sources                                              |
+-------------------------------------------------------+
|  Note                                                 |
+------------------------------------+------------------+
|  Origin URL | CC BY                |  Action buttons  |
+------------------------------------+------------------+

If the origin url and license are short enough, they are placed next to the sources:
+------------------------------+------------------------+
|  Sources                     |    Origin URL | CC BY  |
+------------------------------+-----+------------------+
|  Note                              |  Action buttons  |
+-------------------------------------------------------+

If the note is missing and the sources text is not too long, the sources are placed next to the action buttons:
+------------------------------------+------------------+
|  Sources                           |                  |
+------------------------------------+  Action buttons  |
|  Origin URL | CC BY                |                  |
+-------------------------------------------------------+

*/

// keep in sync with sass variables in Footer.scss
const HORIZONTAL_PADDING = 8

interface FooterProps {
    manager: FooterManager
    maxWidth?: number
}

@observer
export class Footer<
    Props extends FooterProps = FooterProps,
> extends React.Component<Props> {
    verticalPadding = 4

    @computed protected get manager(): FooterManager {
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

    @computed protected get useBaseFontSize(): boolean {
        return !!this.manager.useBaseFontSize
    }

    @computed protected get baseFontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed protected get sourcesLine(): string {
        return this.manager.sourcesLine?.replace(/\r\n|\n|\r/g, "") ?? ""
    }

    @computed protected get sourcesText(): string {
        return `Data source: ${this.sourcesLine} - Learn more about this data`
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
            return "https://creativecommons.org/licenses/by/4.0/"
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
            fontSize,
            maxWidth,
            actionButtons,
        } = this

        if (this.manager.hideOriginUrl) return undefined

        if (!correctedUrlText) return undefined

        const licenseAndOriginUrlText = Footer.constructLicenseAndOriginUrlText(
            correctedUrlText,
            licenseText
        )
        const licenseAndOriginUrlWidth = Bounds.forText(
            licenseAndOriginUrlText,
            { fontSize }
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

    @computed private get lineHeight(): number {
        return this.manager.isSmall ? 1.1 : 1.2
    }

    @computed protected get fontSize(): number {
        if (this.useBaseFontSize) {
            return (11 / BASE_FONT_SIZE) * this.baseFontSize
        }
        return this.manager.isMedium ? 11 : 12
    }

    @computed protected get sourcesFontSize(): number {
        if (this.useBaseFontSize) {
            return (12 / BASE_FONT_SIZE) * this.baseFontSize
        }
        return this.manager.isSmall ? 12 : 13
    }

    @computed protected get showNote(): boolean {
        return !this.manager.hideNote && !!this.noteText
    }

    @computed private get actionButtonsWidthWithIconsOnly(): number {
        return new ActionButtons({
            manager: this.manager,
            maxWidth: this.maxWidth,
        }).widthWithIconsOnly
    }

    @computed private get useFullWidthSources(): boolean {
        const {
            showNote,
            sourcesFontSize,
            maxWidth,
            sourcesText,
            actionButtonsWidthWithIconsOnly,
        } = this
        if (showNote) return true
        const sourcesWidth = Bounds.forText(sourcesText, {
            fontSize: sourcesFontSize,
        }).width
        return sourcesWidth > 2 * (maxWidth - actionButtonsWidthWithIconsOnly)
    }

    @computed private get useFullWidthNote(): boolean {
        const {
            fontSize,
            maxWidth,
            noteText,
            actionButtonsWidthWithIconsOnly,
        } = this
        const noteWidth = Bounds.forText(noteText, { fontSize }).width
        return noteWidth > 2 * (maxWidth - actionButtonsWidthWithIconsOnly)
    }

    @computed protected get sourcesMaxWidth(): number {
        if (this.useFullWidthSources) return this.maxWidth
        return this.maxWidth - this.actionButtons.width - HORIZONTAL_PADDING
    }

    @computed protected get noteMaxWidth(): number {
        if (this.useFullWidthNote) return this.maxWidth
        return this.maxWidth - this.actionButtons.width - HORIZONTAL_PADDING
    }

    @computed protected get licenseAndOriginUrlMaxWidth(): number {
        return this.maxWidth
    }

    @computed protected get showLicenseNextToSources(): boolean {
        const {
            useFullWidthSources,
            maxWidth,
            sources,
            licenseAndOriginUrl,
            note,
        } = this
        if (!useFullWidthSources) return false
        // if there's space, keep the license below the note
        if (this.useFullWidthNote || note.htmlLines.length <= 1) return false
        return (
            sources.width + HORIZONTAL_PADDING + licenseAndOriginUrl.width <=
            maxWidth
        )
    }

    @computed protected get sources(): MarkdownTextWrap {
        const { lineHeight } = this
        return new MarkdownTextWrap({
            text: this.sourcesText,
            maxWidth: this.sourcesMaxWidth,
            fontSize: this.sourcesFontSize,
            lineHeight,
        })
    }

    @computed protected get note(): MarkdownTextWrap {
        const { fontSize, lineHeight, manager } = this
        return new MarkdownTextWrap({
            text: this.markdownNoteText,
            maxWidth: this.noteMaxWidth,
            fontSize,
            lineHeight,
            detailsOrderedByReference:
                manager.shouldIncludeDetailsInStaticExport
                    ? manager.detailsOrderedByReference
                    : new Set(),
        })
    }

    @computed protected get licenseAndOriginUrl(): TextWrap {
        const { fontSize, lineHeight } = this
        return new TextWrap({
            text: this.licenseAndOriginUrlText,
            maxWidth: this.licenseAndOriginUrlMaxWidth,
            rawHtml: true,
            fontSize,
            lineHeight,
        })
    }

    @computed private get actionButtonsMaxWidth(): number {
        const {
            correctedUrlText,
            licenseText,
            maxWidth,
            fontSize,
            sourcesFontSize,
            useFullWidthSources,
            sourcesText,
            noteText,
            showNote,
            useFullWidthNote,
        } = this

        const sourcesWidth = Bounds.forText(sourcesText, {
            fontSize: sourcesFontSize,
        }).width
        const noteWidth = Bounds.forText(noteText, { fontSize }).width

        // text next to the action buttons
        const leftTextWidth = !useFullWidthSources
            ? sourcesWidth
            : showNote && !useFullWidthNote
            ? noteWidth
            : 0
        // text above the action buttons
        // (taken into account to ensure the action buttons are not too close to clickable text)
        const topTextWidth = useFullWidthSources
            ? useFullWidthNote
                ? noteWidth
                : sourcesWidth
            : 0
        const licenseAndOriginUrlWidth = Bounds.forText(
            Footer.constructLicenseAndOriginUrlText(
                correctedUrlText,
                licenseText
            ),
            { fontSize }
        ).width

        return (
            maxWidth -
            Math.max(topTextWidth, leftTextWidth, licenseAndOriginUrlWidth) -
            HORIZONTAL_PADDING
        )
    }

    @computed private get actionButtons(): ActionButtons {
        return new ActionButtons({
            manager: this.manager,
            maxWidth: this.actionButtonsMaxWidth,
        })
    }

    @computed get height(): number {
        return this.topContentHeight + this.bottomContentHeight
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

    private renderLicense(): JSX.Element {
        return (
            <div className="license" style={this.licenseAndOriginUrl.htmlStyle}>
                {this.finalUrlText && (
                    <>
                        <a href={this.finalUrl} target="_blank" rel="noopener">
                            {this.finalUrlText}
                        </a>{" "}
                        |{" "}
                    </>
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
    }

    private renderSources(): JSX.Element | null {
        const sources = new MarkdownTextWrap({
            text: `**Data source:** ${this.sourcesLine}`,
            maxWidth: this.sourcesMaxWidth,
            fontSize: this.sourcesFontSize,
            lineHeight: this.lineHeight,
        })

        return (
            <p className="sources" style={sources.style}>
                {sources.renderHTML()}
                {" – "}
                <a
                    className="learn-more-about-data"
                    data-track-note="chart_click_sources"
                    onClick={action((e) => {
                        e.stopPropagation()

                        // if embbedded, open the sources modal
                        if (
                            this.manager.isEmbeddedInAnOwidPage ||
                            this.manager.isInIFrame
                        ) {
                            this.manager.isSourcesModalOpen = true
                            return
                        }

                        // on data pages, scroll to the "Sources and Processing" section
                        // on grapher pages, open the sources modal
                        const datapageSectionId =
                            DATAPAGE_ABOUT_THIS_DATA_SECTION_ID
                        const sourcesElement =
                            document.getElementById(datapageSectionId)
                        if (sourcesElement && sourcesElement.scrollIntoView) {
                            sourcesElement.scrollIntoView({
                                behavior: "smooth",
                            })
                            this.manager.isInFullScreenMode = false
                        } else if (sourcesElement) {
                            window.location.hash = "#" + datapageSectionId
                            this.manager.isInFullScreenMode = false
                        } else {
                            // on grapher pages, open the sources modal
                            this.manager.isSourcesModalOpen = true
                        }
                    })}
                >
                    Learn more about this data
                </a>
            </p>
        )
    }

    private renderNote(): JSX.Element {
        return (
            <p className="note" style={this.note.style}>
                {this.note.renderHTML()}
            </p>
        )
    }

    private renderVerticalSpace(): JSX.Element {
        return (
            <div
                style={{
                    height: this.verticalPadding,
                    width: "100%",
                }}
            />
        )
    }

    @computed private get topContentHeight(): number {
        const { sources, note } = this

        const renderSources = this.useFullWidthSources
        const renderNote = this.showNote && this.useFullWidthNote

        if (!renderSources && !renderNote) return 0

        return (
            (renderSources ? sources.height : 0) +
            (renderSources && renderNote ? this.verticalPadding : 0) +
            (renderNote ? note.height : 0) +
            this.verticalPadding
        )
    }

    // renders the content above the action buttons
    // make sure to keep this.topContentHeight in sync if you edit this method
    private renderTopContent(): JSX.Element | null {
        const renderSources = this.useFullWidthSources
        const renderNote = this.showNote && this.useFullWidthNote
        const renderLicense = this.showLicenseNextToSources

        if (!renderSources && !renderNote) return null

        return (
            <>
                <div className="SourcesFooterHTMLTop">
                    {renderSources && (
                        <div className="SourcesAndLicense">
                            {this.renderSources()}
                            {renderLicense && this.renderLicense()}
                        </div>
                    )}
                    {renderSources && renderNote && this.renderVerticalSpace()}
                    {renderNote && this.renderNote()}
                </div>
                {this.renderVerticalSpace()}
            </>
        )
    }

    @computed private get bottomContentHeight(): number {
        const { actionButtons, sources, note } = this

        const renderSources = !this.useFullWidthSources
        const renderNote = this.showNote && !this.useFullWidthNote
        const renderLicense = !this.showLicenseNextToSources
        const renderPadding = (renderSources || renderNote) && renderLicense

        const textHeight =
            (renderSources ? sources.height : renderNote ? note.height : 0) +
            (renderPadding ? this.verticalPadding : 0) +
            (renderLicense ? this.licenseAndOriginUrl.height : 0)

        return Math.max(textHeight, actionButtons.height)
    }

    // renders the action buttons and the content next to it
    // make sure to keep this.bottomContentHeight in sync if you edit this method
    private renderBottomContent(): JSX.Element {
        const renderSources = !this.useFullWidthSources
        const renderNote = this.showNote && !this.useFullWidthNote
        const renderLicense = !this.showLicenseNextToSources
        const renderPadding = (renderSources || renderNote) && renderLicense

        const licenseOnly = !renderSources && !renderNote && renderLicense
        const noteOnly = !renderSources && renderNote && !renderLicense

        // center text next to the action buttons if it's only one or two lines
        const style = {
            alignItems:
                licenseOnly || (noteOnly && this.note.htmlLines.length <= 2)
                    ? "center"
                    : "flex-end",
        }

        return (
            <div className="SourcesFooterHTMLBottom" style={style}>
                <div>
                    {renderSources
                        ? this.renderSources()
                        : renderNote
                        ? this.renderNote()
                        : null}
                    {renderPadding && this.renderVerticalSpace()}
                    {renderLicense && this.renderLicense()}
                </div>
                <ActionButtons
                    manager={this.manager}
                    maxWidth={this.actionButtonsMaxWidth}
                />
            </div>
        )
    }

    render(): JSX.Element {
        const { tooltipTarget } = this

        return (
            <footer
                className="SourcesFooterHTML"
                style={{
                    padding: `0 ${this.framePaddingHorizontal}px`,
                }}
                ref={this.base}
            >
                {this.renderTopContent()}
                {this.renderBottomContent()}
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
    verticalPadding = 2

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    componentDidMount(): void {}
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    componentWillUnmount(): void {}

    @computed private get textColor(): string {
        return this.manager.secondaryColorInStaticCharts ?? GRAPHER_DARK_TEXT
    }

    @computed protected get showLicenseNextToSources(): boolean {
        return (
            this.maxWidth - this.sources.width - HORIZONTAL_PADDING >
            this.licenseAndOriginUrl.width
        )
    }

    @computed protected get finalUrlText(): string | undefined {
        const { correctedUrlText, licenseText, fontSize, maxWidth } = this

        if (this.manager.hideOriginUrl) return undefined

        if (!correctedUrlText) return undefined

        const licenseAndOriginUrlText = Footer.constructLicenseAndOriginUrlText(
            correctedUrlText,
            licenseText
        )
        const licenseAndOriginUrlWidth = Bounds.forText(
            licenseAndOriginUrlText,
            { fontSize }
        ).width

        // If the URL is too long, don't show it
        if (licenseAndOriginUrlWidth > maxWidth) return undefined

        return correctedUrlText
    }

    @computed protected get licenseAndOriginUrlText(): string {
        const { finalUrl, finalUrlText, licenseText, licenseUrl, textColor } =
            this
        const textDecoration = this.manager.isStaticAndSmall
            ? "none"
            : "underline"
        const linkStyle = `fill: ${textColor};  text-decoration: ${textDecoration};`
        const licenseSvg = `<a target="_blank" style="${linkStyle}" href="${licenseUrl}">${licenseText}</a>`
        if (!finalUrlText) return licenseSvg
        const originUrlSvg = `<a target="_blank" style="${linkStyle}" href="${finalUrl}">${finalUrlText}</a>`
        return [originUrlSvg, licenseSvg].join(" | ")
    }

    @computed protected get sourcesText(): string {
        return `**Data source:** ${this.sourcesLine}`
    }

    @computed protected get fontSize(): number {
        if (this.useBaseFontSize) {
            const target = this.manager.isStaticAndSmall ? 10 : 12
            return (target / BASE_FONT_SIZE) * this.baseFontSize
        }
        return 13
    }

    @computed protected get sourcesFontSize(): number {
        return this.fontSize
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
            (this.showNote ? this.note.height + this.verticalPadding : 0) +
            (this.showLicenseNextToSources
                ? 0
                : this.licenseAndOriginUrl.height + this.verticalPadding)
        )
    }

    render(): JSX.Element {
        const {
            sources,
            note,
            licenseAndOriginUrl,
            showLicenseNextToSources,
            maxWidth,
            textColor,
        } = this
        const { targetX, targetY } = this.props

        return (
            <g
                className="SourcesFooter"
                style={{
                    fill: textColor,
                }}
            >
                {sources.renderSVG(targetX, targetY)}
                {this.showNote &&
                    note.renderSVG(
                        targetX,
                        targetY + sources.height + this.verticalPadding
                    )}
                {showLicenseNextToSources
                    ? licenseAndOriginUrl.render(
                          targetX + maxWidth - licenseAndOriginUrl.width,
                          targetY
                      )
                    : licenseAndOriginUrl.render(
                          targetX,
                          targetY +
                              sources.height +
                              (this.showNote
                                  ? note.height + this.verticalPadding
                                  : 0) +
                              this.verticalPadding
                      )}
            </g>
        )
    }
}
