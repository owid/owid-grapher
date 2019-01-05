import * as React from 'react'
import { observable, computed, action } from 'mobx'
import { observer } from 'mobx-react'
import * as parseUrl from 'url-parse'

import TextWrap from './TextWrap'
import ChartConfig from './ChartConfig'
import Bounds from './Bounds'
import {getRelativeMouse} from './Util'
import Tooltip from './Tooltip'

// Metadata reflection hack - Mispy
declare const global: any
if (typeof(global) !== "undefined") {
    global.MouseEvent = {}
}

interface SourcesFooterProps {
    chart: ChartConfig,
    maxWidth: number
}

export default class SourcesFooter {
    props: SourcesFooterProps
    constructor(props: SourcesFooterProps) {
        this.props = props
    }

    @computed get maxWidth() {
        return this.props.maxWidth
    }

    @computed get sourcesText(): string {
        const sourcesLine = this.props.chart.data.sourcesLine
        return sourcesLine ? `Source: ${sourcesLine}` : ''
    }

    @computed get noteText(): string {
        return this.props.chart.note ? `Note: ${this.props.chart.note}` : ''
    }

    @computed get ccSvg(): string {
        return `<a style="fill: #777;" class="cclogo" href="http://creativecommons.org/licenses/by-sa/4.0/deed.en_US" target="_blank">CC BY-SA</a>`
    }

    @computed get licenseSvg(): string {
        if (this.props.chart.isNativeEmbed)
            return this.ccSvg

        const { originUrl } = this.props.chart.data
        let licenseSvg = `*data-entry* • ${this.ccSvg}`

        // Make sure the link back to OWID is consistent
        // And don't show the full url if there isn't enough room
        if (originUrl && originUrl.toLowerCase().match(/^https?:\/\/./)) {
            const url = parseUrl(originUrl)
            const finalUrl = `https://${url.hostname}${url.pathname}`
            const finalUrlText = `${url.hostname}${url.pathname}`.replace("ourworldindata.org", "OurWorldInData.org")
            if (Bounds.forText(finalUrlText, { fontSize: this.fontSize }).width > 0.7*this.maxWidth)
                return this.ccSvg

            licenseSvg = licenseSvg.replace(/\*data-entry\*/, "<a target='_blank' style='fill: #777;' href='" + finalUrl + "'>" + finalUrlText + "</a>")
        } else {
            return this.ccSvg
        }

        return licenseSvg
    }

    @computed get fontSize() {
        return 0.7*this.props.chart.baseFontSize
    }

    @computed get sources() {
        const { maxWidth, fontSize, sourcesText } = this
        return new TextWrap({ maxWidth: maxWidth, fontSize: fontSize, text: sourcesText })
    }

    @computed get note() {
        const { maxWidth, fontSize, noteText } = this
        return new TextWrap({ maxWidth: maxWidth, fontSize: fontSize, text: noteText })
    }

    @computed get license() {
        const { maxWidth, fontSize, licenseSvg } = this
        return new TextWrap({ maxWidth: maxWidth * 3, fontSize: fontSize, text: licenseSvg, raw: true })
    }

    // Put the license stuff to the side if there's room
    @computed get isCompact() {
        return this.maxWidth - this.sources.width - 5 > this.license.width
    }

    @computed get paraMargin() {
        return 2
    }

    @computed get height(): number {
        if (this.props.chart.isMediaCard)
            return 0

        const { sources, note, license, isCompact, paraMargin } = this
        return sources.height + (note.height ? paraMargin + note.height : 0) + (isCompact ? 0 : paraMargin + license.height)
    }

    @action.bound onSourcesClick() {
        this.props.chart.tab = 'sources'
    }

    render(targetX: number, targetY: number) {
        if (this.props.chart.isMediaCard)
            return null

        return <SourcesFooterView footer={this} targetX={targetX} targetY={targetY}/>
    }
}

@observer
class SourcesFooterView extends React.Component<{ footer: SourcesFooter, targetX: number, targetY: number }> {
    base: React.RefObject<SVGGElement> = React.createRef()
    @observable.ref tooltipTarget?: { x: number, y: number }

    @action.bound onMouseMove(e: MouseEvent) {
        const cc = this.base.current!.querySelector(".cclogo")
        if (cc && cc.matches(':hover')) {
            const mouse = getRelativeMouse(this.base.current, e)
            this.tooltipTarget = { x: mouse.x, y: mouse.y }
        } else
            this.tooltipTarget = undefined
    }

    componentDidMount() {
        window.addEventListener("mousemove", this.onMouseMove)
    }

    componentWillUnmount() {
        window.removeEventListener("mousemove", this.onMouseMove)
    }

    render() {
        const { targetX, targetY } = this.props
        const { sources, note, license, maxWidth, isCompact, paraMargin, onSourcesClick } = this.props.footer
        const { tooltipTarget } = this

        return <g ref={this.base} className="SourcesFooter" style={{ fill: "#777" }}>
            <g className="clickable" onClick={onSourcesClick} style={{ fill: "#777" }}>{sources.render(targetX, targetY)}</g>
            {note.render(targetX, targetY + sources.height + paraMargin)}
            {isCompact
                ? license.render(targetX + maxWidth - license.width, targetY)
                : license.render(targetX, targetY + sources.height + paraMargin + (note.height ? note.height + paraMargin : 0))
            }
            {tooltipTarget && <Tooltip x={tooltipTarget.x} y={tooltipTarget.y} style={{ textAlign: "center", maxWidth: "300px", whiteSpace: 'inherit', padding: '10px', fontSize: '0.8em' }}>
                <p>Our World in Data charts are licensed under Creative Commons; you are free to use, share, and adapt this material. Click through to the CC BY-SA page for more information.</p>
            </Tooltip>}
        </g>
    }
}