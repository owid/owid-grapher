import { extend, keys } from './Util'
import * as React from 'react'
import { observable, computed, action } from 'mobx'
import { observer } from 'mobx-react'
import * as Cookies from 'js-cookie'
import ChartConfig from './ChartConfig'
import { getQueryParams } from './Util'
import ChartView from './ChartView'
import { HighlightToggleConfig } from './ChartConfig'
import HTMLTimeline from './HTMLTimeline'

declare const Global: { rootUrl: string }

@observer
class EmbedMenu extends React.Component<{ embedUrl: string }> {
    render() {
        const { embedUrl } = this.props

        return <div className="embedMenu" onClick={evt => evt.stopPropagation()}>
            <h2>Embed</h2>
            <p>Paste this into any HTML page:</p>
            <textarea onFocus={evt => evt.currentTarget.select()}>
                {`<iframe src="${embedUrl}" style="width: 100%; height: 600px; border: 0px none;"></iframe>`}
            </textarea>
        </div>
    }
}

interface ShareMenuProps {
    chart: ChartConfig,
    chartView: any,
    onDismiss: () => void
}

@observer
class ShareMenu extends React.Component<ShareMenuProps> {
    @computed get title(): string {
        return this.props.chart.data.currentTitle
    }

    @computed get editUrl(): string | undefined {
        return Cookies.get('isAdmin') ? `${Global.rootUrl}/admin/charts/${this.props.chart.props.id}/edit` : undefined
    }

    @computed get canonicalUrl(): string | undefined {
        return this.props.chart.url.canonicalUrl
    }

    @observable isEmbedMenuActive: boolean = false

    embedMenu: any

    @action.bound onClickOutside() {
        this.props.chartView.removePopup(EmbedMenu)

        if (this.props.onDismiss)
            this.props.onDismiss()
    }

    componentDidMount() {
        setTimeout(() => {
            window.addEventListener('click', this.onClickOutside)
        }, 50)
    }

    componentWillUnmount() {
        window.removeEventListener('click', this.onClickOutside)
    }

    @action.bound onEmbed() {
        if (this.canonicalUrl)
            this.props.chartView.addPopup(<EmbedMenu embedUrl={this.canonicalUrl} />)
    }

    @computed get twitterHref(): string {
        let href = "https://twitter.com/intent/tweet/?text=" + encodeURIComponent(this.title)
        if (this.canonicalUrl)
            href += "&url=" + encodeURIComponent(this.canonicalUrl)
        return href
    }

    @computed get facebookHref(): string {
        let href = "https://www.facebook.com/dialog/share?app_id=1149943818390250&display=page"
        if (this.canonicalUrl)
            href += "&href=" + encodeURIComponent(this.canonicalUrl)
        return href
    }

    render() {
        const { editUrl, twitterHref, facebookHref } = this

        return <div className="shareMenu" onClick={(evt) => evt.stopPropagation()}>
            <h2>Share</h2>
            <a className="btn" target="_blank" title="Tweet a link" href={twitterHref}>
                <i className="fa fa-twitter" /> Twitter
            </a>
            <a className="btn" target="_blank" title="Share on Facebook" href={facebookHref}>
                <i className="fa fa-facebook" /> Facebook
            </a>
            <a className="btn" title="Embed this visualization in another HTML document" onClick={this.onEmbed}>
                <i className="fa fa-code" /> Embed
            </a>
            {editUrl && <a className="btn" target="_blank" title="Edit chart" href={editUrl}>
                <i className="fa fa-edit" /> Edit
            </a>}
        </div>
    }
}

interface ControlsFooterProps {
    chart: ChartConfig,
    chartView: ChartView,
}

@observer
class HighlightToggle extends React.Component<{ chart: ChartConfig, highlightToggle: HighlightToggleConfig }> {
    @computed get chart() { return this.props.chart }
    @computed get highlight() { return this.props.highlightToggle }

    @computed get highlightParams() {
        return getQueryParams((this.highlight.paramStr || "").substring(1))
    }

    @action.bound onHighlightToggle(e: React.FormEvent<HTMLInputElement>) {
        if (e.currentTarget.checked) {
            const params = getQueryParams()
            this.chart.url.populateFromURL(extend(params, this.highlightParams))
        } else {
            this.chart.data.selectedKeys = []
        }
    }

    get isHighlightActive() {
        const params = getQueryParams()
        let isActive = true
        keys(this.highlightParams).forEach((key) => {
            if (params[key] !== this.highlightParams[key])
                isActive = false
        })
        return isActive
    }

    render() {
        const { highlight, isHighlightActive } = this
        return <label className="clickable HighlightToggle">
            <input type="checkbox" checked={isHighlightActive} onChange={this.onHighlightToggle} /> {highlight.description}
        </label>
    }
}

@observer
class AbsRelToggle extends React.Component<{ chart: ChartConfig }> {
    @action.bound onToggle() {
        const { stackedArea } = this.props.chart
        stackedArea.isRelative = !stackedArea.isRelative
    }

    render() {
        const { chart } = this.props
        return <label className="clickable">
            <input type="checkbox" checked={chart.stackedArea.isRelative} onChange={this.onToggle} /> {chart.isStackedArea ? "Relative" : "Average annual change"}
        </label>
    }
}

@observer
class TimelineControl extends React.Component<{ chart: ChartConfig }> {
    @action.bound onMapTargetChange({ targetStartYear }: { targetStartYear: number }) {
        this.props.chart.map.targetYear = targetStartYear
    }

    @action.bound onScatterTargetChange({ targetStartYear, targetEndYear }: { targetStartYear: number, targetEndYear: number }) {
        this.props.chart.timeDomain = [targetStartYear, targetEndYear]
    }

    @action.bound onTimelineStart() {
        this.props.chart.scatter.useTimelineDomains = true
    }

    @action.bound onTimelineStop() {
        this.props.chart.scatter.useTimelineDomains = false
    }

    render() {
        const {chart} = this.props
        if (chart.props.tab === 'map') {
            const {map} = chart
            return <HTMLTimeline years={map.data.timelineYears} onTargetChange={this.onMapTargetChange} startYear={map.data.targetYear} endYear={map.data.targetYear} singleYearMode={true}/>
        } else {
            return <HTMLTimeline years={chart.scatter.timelineYears} onTargetChange={this.onScatterTargetChange} startYear={chart.scatter.startYear} endYear={chart.scatter.endYear} onStartDrag={this.onTimelineStart} onStopDrag={this.onTimelineStop}/>
        }
    }
}

export class ControlsFooter {
    props: { chart: ChartConfig, chartView: ChartView, width: number }
    constructor(props: { chart: ChartConfig, chartView: ChartView, width: number }) {
        this.props = props
    }

    @observable isShareMenuActive: boolean = false

    @computed get addDataTerm() {
        const { chart } = this.props
        return chart.data.isSingleEntity ? "data" : chart.entityType
    }

    @computed get hasTimeline(): boolean {
        const {chart} = this.props
        return (chart.tab === 'map' && chart.map.data.hasTimeline) || (chart.tab === 'chart' && chart.isScatter && chart.scatter.hasTimeline)
    }

    @computed get hasExtraControls(): boolean {
        const {chart} = this.props
        return chart.tab === 'chart' && (chart.data.canAddData || chart.isScatter || chart.data.canChangeEntity || (chart.isStackedArea && chart.stackedArea.canToggleRelative))
    }

    @computed get hasSpace(): boolean {
        return this.props.width > 700
    }

    @computed get numLines(): number {
        let numLines = 1
        if (this.hasTimeline) numLines += 1
        if (this.hasExtraControls) numLines += 1
        if (this.hasSpace && numLines > 1) numLines -= 1
        return numLines
    }

    @computed get height(): number {
        return this.numLines*40
    }
}

@observer
export class ControlsFooterView extends React.Component<{ controlsFooter: ControlsFooter }> {
    @action.bound onShareMenu() {
        this.props.controlsFooter.isShareMenuActive = !this.props.controlsFooter.isShareMenuActive
    }

    @action.bound onDataSelect() {
        this.props.controlsFooter.props.chartView.isSelectingData = true
    }

    render() {
        const { props } = this
        const {isShareMenuActive, hasTimeline, hasExtraControls, addDataTerm, hasSpace} = props.controlsFooter
        const {chart, chartView} = props.controlsFooter.props

        const tabs = <nav className="tabs">
            <ul>
                {chart.availableTabs.map(tabName => {
                    return tabName !== 'download' && <li className={"tab clickable" + (tabName === chart.tab ? ' active' : '')} onClick={() => chart.tab = tabName}><a>{tabName}</a></li>
                })}
                <li className={"tab clickable icon" + (chart.tab === 'download' ? ' active' : '')} onClick={() => chart.tab = 'download'} title="Download as .png or .svg">
                    <a><i className="fa fa-download" /></a>
                </li>
                <li className="clickable icon"><a title="Share" onClick={this.onShareMenu}><i className="fa fa-share-alt" /></a></li>
                {chartView.isEmbed && <li className="clickable icon"><a title="Open chart in new tab" href={chart.url.canonicalUrl} target="_blank"><i className="fa fa-expand" /></a></li>}
            </ul>
        </nav>

        const timeline = hasTimeline && <TimelineControl chart={chart}/>

        const extraControls = hasExtraControls && <div className="extraControls">
            {chart.data.canAddData && <button type="button" onClick={this.onDataSelect}>
                {chart.isScatter ? <span><i className="fa fa-search" /> Search</span> : <span><i className="fa fa-plus" /> Add {addDataTerm}</span>}
            </button>}

            {chart.data.canChangeEntity && <button type="button" onClick={this.onDataSelect}>
                <i className="fa fa-exchange" /> Change {chart.entityType}
            </button>}

            {chart.isScatter && chart.highlightToggle && <HighlightToggle chart={chart} highlightToggle={chart.highlightToggle} />}
            {chart.isStackedArea && chart.stackedArea.canToggleRelative && <AbsRelToggle chart={chart} />}
            {chart.isScatter && chart.scatter.canToggleRelative && <AbsRelToggle chart={chart} />}
        </div>

        return <div className="ControlsFooter" style={{ height: props.controlsFooter.height }}>
            {hasTimeline && (hasExtraControls || !hasSpace) && <div className="footerRowSingle">
                {timeline}
            </div>}
            {hasExtraControls && !hasSpace && <div className="footerRowSingle">
                {extraControls}
            </div>}
            {hasSpace && <div className="footerRowMulti">
                <div>
                    {hasExtraControls ? extraControls : timeline}
                </div>
                {tabs}
            </div>}
            {!hasSpace && <div className="footerRowSingle">
                {tabs}
            </div>}
            {isShareMenuActive && <ShareMenu chartView={chartView} chart={chart} onDismiss={this.onShareMenu} />}
        </div>
    }
}

