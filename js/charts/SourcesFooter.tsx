import * as React from 'react'
import { computed, action } from 'mobx'
import TextWrap from './TextWrap'
import ChartConfig from './ChartConfig'
import * as parseUrl from 'url-parse'

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

    @computed get licenseSvg(): string {
        const { originUrl } = this.props.chart.data
        let licenseSvg = `*data-entry* • <a style="fill: #777;" href="http://creativecommons.org/licenses/by-sa/4.0/deed.en_US" target="_blank">CC BY-SA</a>`

        // Make sure the link back to OWID is consistent
        if (originUrl && originUrl.toLowerCase().indexOf("ourworldindata.org") !== -1) {
            const url = parseUrl(originUrl)
            const finalUrl = `https://ourworldindata.org${url.pathname}`
            licenseSvg = licenseSvg.replace(/\*data-entry\*/, "<a target='_blank' style='fill: #777;' href='" + finalUrl + "'>" + "OurWorldInData.org" + url.pathname + "</a>")
        } else {
            licenseSvg = licenseSvg.replace(/\*data-entry\*/,
                "<a target='_blank' style='fill: #777;' href='http://ourworldindata.org'>OurWorldInData.org</a>")
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
        const { sources, note, license, isCompact, paraMargin } = this
        return sources.height + (note.height ? paraMargin + note.height : 0) + (isCompact ? 0 : paraMargin + license.height)
    }

    @action.bound onSourcesClick() {
        this.props.chart.tab = 'sources'
    }

    render(targetX: number, targetY: number) {
        const { sources, note, license, maxWidth, isCompact, paraMargin, onSourcesClick } = this

        return <g className="SourcesFooter" style={{ fill: "#777" }}>
            <g className="clickable" onClick={onSourcesClick} style={{ fill: "#777" }}>{sources.render(targetX, targetY)}</g>
            {note.render(targetX, targetY + sources.height + paraMargin)}
            {isCompact
                ? license.render(targetX + maxWidth - license.width, targetY)
                : license.render(targetX, targetY + sources.height + paraMargin + (note.height ? note.height + paraMargin : 0))
            }
        </g>
    }
}
