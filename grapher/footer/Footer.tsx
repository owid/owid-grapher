import * as React from "react"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import parseUrl from "url-parse"
import { TextWrap } from "grapher/text/TextWrap"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { getRelativeMouse } from "grapher/utils/Util"
import { Tooltip } from "grapher/tooltip/Tooltip"
import { BASE_FONT_SIZE, GrapherTabOption } from "grapher/core/GrapherConstants"
import { FooterManager } from "./FooterManager"

@observer
export class Footer extends React.Component<{
    manager: FooterManager
    maxWidth?: number
}> {
    @computed private get maxWidth() {
        return this.props.maxWidth ?? DEFAULT_BOUNDS.width
    }

    @computed private get manager() {
        return this.props.manager
    }

    @computed private get sourcesText() {
        const sourcesLine = this.manager.sourcesLine
        return sourcesLine ? `Source: ${sourcesLine}` : ""
    }

    @computed private get noteText() {
        return this.manager.note ? `Note: ${this.manager.note}` : ""
    }

    @computed private get ccSvg() {
        if (this.manager.hasOWIDLogo)
            return `<a style="fill: #777;" class="cclogo" href="http://creativecommons.org/licenses/by/4.0/deed.en_US" target="_blank">CC BY</a>`

        return `<a href="https://ourworldindata.org" target="_blank">Powered by ourworldindata.org</a>`
    }

    @computed private get originUrlWithProtocol() {
        return this.manager.originUrlWithProtocol ?? "http://localhost"
    }

    @computed private get finalUrl() {
        const originUrl = this.originUrlWithProtocol
        const url = parseUrl(originUrl)
        return `https://${url.hostname}${url.pathname}`
    }

    @computed private get finalUrlText() {
        const originUrl = this.originUrlWithProtocol

        // Make sure the link back to OWID is consistent
        // And don't show the full url if there isn't enough room
        if (originUrl && originUrl.toLowerCase().match(/^https?:\/\/./)) {
            const url = parseUrl(originUrl)
            const finalUrlText = `${url.hostname}${url.pathname}`.replace(
                "ourworldindata.org",
                "OurWorldInData.org"
            )
            if (
                this.manager.isNativeEmbed ||
                Bounds.forText(finalUrlText, { fontSize: this.fontSize })
                    .width >
                    0.7 * this.maxWidth
            )
                return undefined
            return finalUrlText
        }
        return undefined
    }

    @computed private get licenseSvg() {
        const { finalUrl, finalUrlText, ccSvg } = this
        if (!finalUrlText) return ccSvg

        return `*data-entry* • ${ccSvg}`.replace(
            /\*data-entry\*/,
            "<a target='_blank' style='fill: #777;' href='" +
                finalUrl +
                "'>" +
                finalUrlText +
                "</a>"
        )
    }

    @computed private get fontSize() {
        return 0.7 * (this.manager.fontSize ?? BASE_FONT_SIZE)
    }

    @computed private get sources() {
        const { maxWidth, fontSize, sourcesText } = this
        return new TextWrap({
            maxWidth,
            fontSize,
            text: sourcesText,
            linkifyText: true,
        })
    }

    @computed private get note() {
        const { maxWidth, fontSize, noteText } = this
        return new TextWrap({
            maxWidth,
            fontSize,
            text: noteText,
            linkifyText: true,
        })
    }

    @computed private get license() {
        const { maxWidth, fontSize, licenseSvg } = this
        return new TextWrap({
            maxWidth: maxWidth * 3,
            fontSize,
            text: licenseSvg,
            rawHtml: true,
        })
    }

    // Put the license stuff to the side if there's room
    @computed private get isCompact() {
        return this.maxWidth - this.sources.width - 5 > this.license.width
    }

    @computed private get paraMargin() {
        return 2
    }

    @computed get height() {
        if (this.manager.isMediaCard) return 0

        const { sources, note, license, isCompact, paraMargin } = this
        return (
            sources.height +
            (note.height ? paraMargin + note.height : 0) +
            (isCompact ? 0 : paraMargin + license.height)
        )
    }

    @action.bound private onSourcesClick() {
        this.manager.currentTab = GrapherTabOption.sources
    }

    renderStatic(targetX: number, targetY: number) {
        if (this.manager.isMediaCard) return null

        const { sources, note, license, maxWidth, isCompact, paraMargin } = this

        return (
            <g className="SourcesFooter" style={{ fill: "#777" }}>
                <g style={{ fill: "#777" }}>
                    {sources.render(targetX, targetY)}
                </g>
                {note.render(targetX, targetY + sources.height + paraMargin)}
                {isCompact
                    ? license.render(
                          targetX + maxWidth - license.width,
                          targetY
                      )
                    : license.render(
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

    @action.bound private onMouseMove(e: MouseEvent) {
        const cc = this.base.current!.querySelector(".cclogo")
        if (cc && cc.matches(":hover")) {
            const div = this.base.current as HTMLDivElement
            const mouse = getRelativeMouse(div.closest(".chart"), e)
            this.tooltipTarget = { x: mouse.x, y: mouse.y }
        } else this.tooltipTarget = undefined
    }

    componentDidMount() {
        window.addEventListener("mousemove", this.onMouseMove)
    }

    componentWillUnmount() {
        window.removeEventListener("mousemove", this.onMouseMove)
    }

    render() {
        const { tooltipTarget } = this

        const license = (
            <div
                className="license"
                style={{
                    fontSize: this.license.fontSize,
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
                <p
                    style={this.sources.htmlStyle}
                    className="clickable"
                    onClick={this.onSourcesClick}
                >
                    {this.sources.renderHTML()}
                </p>
                {this.note && (
                    <p style={this.note.htmlStyle}>{this.note.renderHTML()}</p>
                )}
                {!this.isCompact && license}
                {tooltipTarget && (
                    <Tooltip
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
                            information.
                        </p>
                    </Tooltip>
                )}
            </footer>
        )
    }
}
