import * as React from "react"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import parseUrl from "url-parse"

import { TextWrap } from "charts/TextWrap"
import { ChartConfig } from "charts/ChartConfig"
import { Bounds } from "charts/Bounds"
import { getRelativeMouse } from "charts/Util"
import { Tooltip } from "./Tooltip"

interface SourcesFooterProps {
    chart: ChartConfig
    maxWidth: number
}

export class SourcesFooter {
    props: SourcesFooterProps
    constructor(props: SourcesFooterProps) {
        this.props = props
    }

    @computed get maxWidth() {
        return this.props.maxWidth
    }

    @computed get sourcesText(): string {
        const sourcesLine = this.props.chart.sourcesLine
        return sourcesLine ? `Source: ${sourcesLine}` : ""
    }

    @computed get noteText(): string {
        return this.props.chart.note ? `Note: ${this.props.chart.note}` : ""
    }

    @computed get ccSvg(): string {
        if (this.props.chart.hasOWIDLogo) {
            return `<a style="fill: #777;" class="cclogo" href="http://creativecommons.org/licenses/by/4.0/deed.en_US" target="_blank">CC BY</a>`
        } else {
            return `<a href="https://ourworldindata.org" target="_blank">Powered by ourworldindata.org</a>`
        }
    }

    @computed get finalUrl(): string {
        const originUrl = this.props.chart.originUrlWithProtocol
        const url = parseUrl(originUrl)
        return `https://${url.hostname}${url.pathname}`
    }

    @computed get finalUrlText(): string | undefined {
        const originUrl = this.props.chart.originUrlWithProtocol

        // Make sure the link back to OWID is consistent
        // And don't show the full url if there isn't enough room
        if (originUrl && originUrl.toLowerCase().match(/^https?:\/\/./)) {
            const url = parseUrl(originUrl)
            const finalUrlText = `${url.hostname}${url.pathname}`.replace(
                "ourworldindata.org",
                "OurWorldInData.org"
            )
            if (
                this.props.chart.isNativeEmbed ||
                Bounds.forText(finalUrlText, { fontSize: this.fontSize })
                    .width >
                    0.7 * this.maxWidth
            )
                return undefined
            else return finalUrlText
        } else {
            return undefined
        }
    }

    @computed private get licenseSvg(): string {
        const { finalUrl, finalUrlText } = this
        if (finalUrlText) {
            let licenseSvg = `*data-entry* • ${this.ccSvg}`
            licenseSvg = licenseSvg.replace(
                /\*data-entry\*/,
                "<a target='_blank' style='fill: #777;' href='" +
                    finalUrl +
                    "'>" +
                    finalUrlText +
                    "</a>"
            )
            return licenseSvg
        } else {
            return this.ccSvg
        }
    }

    @computed get fontSize() {
        return 0.7 * this.props.chart.baseFontSize
    }

    @computed get sources() {
        const { maxWidth, fontSize, sourcesText } = this
        return new TextWrap({
            maxWidth: maxWidth,
            fontSize: fontSize,
            text: sourcesText,
            linkifyText: true
        })
    }

    @computed get note() {
        const { maxWidth, fontSize, noteText } = this
        return new TextWrap({
            maxWidth: maxWidth,
            fontSize: fontSize,
            text: noteText,
            linkifyText: true
        })
    }

    @computed get license() {
        const { maxWidth, fontSize, licenseSvg } = this
        return new TextWrap({
            maxWidth: maxWidth * 3,
            fontSize: fontSize,
            text: licenseSvg,
            rawHtml: true
        })
    }

    // Put the license stuff to the side if there's room
    @computed get isCompact() {
        return this.maxWidth - this.sources.width - 5 > this.license.width
    }

    @computed get paraMargin() {
        return 2
    }

    @computed get height(): number {
        if (this.props.chart.isMediaCard) return 0

        const { sources, note, license, isCompact, paraMargin } = this
        return (
            sources.height +
            (note.height ? paraMargin + note.height : 0) +
            (isCompact ? 0 : paraMargin + license.height)
        )
    }

    @action.bound onSourcesClick() {
        this.props.chart.tab = "sources"
    }

    render(targetX: number, targetY: number) {
        if (this.props.chart.isMediaCard) return null

        return (
            <SourcesFooterView
                footer={this}
                targetX={targetX}
                targetY={targetY}
            />
        )
    }
}

@observer
class SourcesFooterView extends React.Component<{
    footer: SourcesFooter
    targetX: number
    targetY: number
}> {
    render() {
        const { targetX, targetY } = this.props
        const {
            sources,
            note,
            license,
            maxWidth,
            isCompact,
            paraMargin,
            onSourcesClick
        } = this.props.footer

        return (
            <g className="SourcesFooter" style={{ fill: "#777" }}>
                <g
                    className="clickable"
                    onClick={onSourcesClick}
                    style={{ fill: "#777" }}
                >
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
}

@observer
export class SourcesFooterHTML extends React.Component<{
    chart: ChartConfig
    footer: SourcesFooter
}> {
    base: React.RefObject<HTMLDivElement> = React.createRef()
    @observable.ref tooltipTarget?: { x: number; y: number }

    @action.bound onMouseMove(e: MouseEvent) {
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
        const { footer } = this.props
        const { tooltipTarget } = this

        const license = (
            <div
                className="license"
                style={{
                    fontSize: footer.license.fontSize,
                    lineHeight: footer.sources.lineHeight
                }}
            >
                {footer.finalUrlText && (
                    <a href={footer.finalUrl} target="_blank">
                        {footer.finalUrlText} •{" "}
                    </a>
                )}
                {this.props.chart.hasOWIDLogo ? (
                    <a
                        className="cclogo"
                        href="http://creativecommons.org/licenses/by/4.0/deed.en_US"
                        target="_blank"
                    >
                        CC BY
                    </a>
                ) : (
                    <a href="https://ourworldindata.org" target="_blank">
                        Powered by ourworldindata.org
                    </a>
                )}
            </div>
        )

        return (
            <footer
                className={
                    "SourcesFooterHTML" + (footer.isCompact ? " compact" : "")
                }
                ref={this.base}
                style={{ color: "#777" }}
            >
                {footer.isCompact && license}
                <p
                    style={footer.sources.htmlStyle}
                    className="clickable"
                    onClick={footer.onSourcesClick}
                >
                    {footer.sources.renderHTML()}
                </p>
                {footer.note && (
                    <p style={footer.note.htmlStyle}>
                        {footer.note.renderHTML()}
                    </p>
                )}
                {!footer.isCompact && license}
                {tooltipTarget && (
                    <Tooltip
                        x={tooltipTarget.x}
                        y={tooltipTarget.y}
                        style={{
                            textAlign: "center",
                            maxWidth: "300px",
                            whiteSpace: "inherit",
                            padding: "10px",
                            fontSize: "0.8em"
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
