import * as React from 'react'
import { observable, computed, action } from 'mobx'
import { observer } from 'mobx-react'
import * as Cookies from 'js-cookie'

import { ChartConfig } from './ChartConfig'
import { getQueryParams } from 'utils/client/url'
import { ChartView } from './ChartView'
import { HighlightToggleConfig } from './ChartConfig'
import { Timeline } from './HTMLTimeline'
import { extend, keys } from './Util'
import { worldRegions, labelsByRegion } from './WorldRegions'
import { faCode, faEdit, faDownload, faShareAlt, faCog, faExpand, faPlus, faSearch, faExchangeAlt } from '@fortawesome/free-solid-svg-icons'
import { faTwitter, faFacebook } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ADMIN_BASE_URL } from 'settings'

@observer
class EmbedMenu extends React.Component<{ chartView: ChartView, embedUrl: string }> {
    dismissable = true

    @action.bound onClickSomewhere() {
        if (this.dismissable) {
            this.props.chartView.removePopup(EmbedMenu)
        } else {
            this.dismissable = true
        }
    }

    @action.bound onClick() {
        this.dismissable = false
    }

    componentDidMount() {
        document.addEventListener('click', this.onClickSomewhere)
    }

    componentWillUnmount() {
        document.removeEventListener('click', this.onClickSomewhere)
    }

    render() {
        const { embedUrl } = this.props

        return <div className="embedMenu" onClick={this.onClick}>
            <h2>Embed</h2>
            <p>Paste this into any HTML page:</p>
            <textarea onFocus={evt => evt.currentTarget.select()} defaultValue={`<iframe src="${embedUrl}" style="width: 100%; height: 600px; border: 0px none;"></iframe>`}/>
        </div>
    }
}

@observer
class ShareMenu extends React.Component<{ chart: ChartConfig, chartView: any, onDismiss: () => void }> {
    dismissable = true

    @computed get title(): string {
        return this.props.chart.data.currentTitle
    }

    @computed get isDisabled(): boolean {
        return !this.props.chart.props.slug
    }

    @computed get editUrl(): string | undefined {
        return Cookies.get('isAdmin') ? `${ADMIN_BASE_URL}/admin/charts/${this.props.chart.props.id}/edit` : undefined
    }

    @computed get canonicalUrl(): string | undefined {
        return this.props.chart.url.canonicalUrl
    }

    @observable isEmbedMenuActive: boolean = false

    embedMenu: any

    @action.bound dismiss() {
        this.props.onDismiss()
    }

    @action.bound onClickSomewhere() {
        if (this.dismissable) {
            this.dismiss()
        } else {
            this.dismissable = true
        }
    }

    componentDidMount() {
        document.addEventListener('click', this.onClickSomewhere)
    }

    componentWillUnmount() {
        document.removeEventListener('click', this.onClickSomewhere)
    }

    @action.bound onEmbed() {
        if (this.canonicalUrl) {
            this.props.chartView.addPopup(<EmbedMenu key="EmbedMenu" chartView={this.props.chartView} embedUrl={this.canonicalUrl} />)
            this.dismiss()
        }
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
        const { editUrl, twitterHref, facebookHref, isDisabled } = this

        return <div className={"ShareMenu" + (isDisabled ? " disabled" : "")} onClick={action(() => this.dismissable = false)}>
            <h2>Share</h2>
            <a className="btn" target="_blank" title="Tweet a link" href={twitterHref}>
                <FontAwesomeIcon icon={faTwitter}/> Twitter
            </a>
            <a className="btn" target="_blank" title="Share on Facebook" href={facebookHref}>
                <FontAwesomeIcon icon={faFacebook}/> Facebook
            </a>
            <a className="btn" title="Embed this visualization in another HTML document" onClick={this.onEmbed}>
                <FontAwesomeIcon icon={faCode}/> Embed
            </a>
            {editUrl && <a className="btn" target="_blank" title="Edit chart" href={editUrl}>
                <FontAwesomeIcon icon={faEdit}/> Edit
            </a>}
        </div>
    }
}

@observer
class SettingsMenu extends React.Component<{ chart: ChartConfig, onDismiss: () => void }> {
    @action.bound onClickOutside() {
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

    @action.bound onProjectionChange(e: React.FormEvent<HTMLSelectElement>) {
        this.props.chart.map.props.projection = (e.currentTarget.value as any)
    }

    render() {
        const {chart} = this.props

        return <div className="SettingsMenu" onClick={(evt) => evt.stopPropagation()}>
            <h2>Settings</h2>
            {chart.props.tab === 'map' &&  <div className="form-field">
                <label>World Region</label>
                <select value={chart.map.props.projection} onChange={this.onProjectionChange}>
                    {worldRegions.map(region =>
                        <option value={region}>{labelsByRegion[region]}</option>
                    )}
                </select>
            </div>}
        </div>
    }
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

        let label = "Relative"
        if (chart.isScatter || chart.isTimeScatter)
            label = "Average annual change"
        else if (chart.isLineChart)
            label = "Show relative change"

        return <label className="clickable">
            <input type="checkbox" checked={chart.stackedArea.isRelative} onChange={this.onToggle} /> {label}
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
            return <Timeline years={map.data.timelineYears} onTargetChange={this.onMapTargetChange} startYear={map.data.targetYear} endYear={map.data.targetYear} singleYearMode={true}/>
        } else if (chart.isScatter) {
            return <Timeline years={chart.scatter.timelineYears} onTargetChange={this.onScatterTargetChange} startYear={chart.scatter.startYear} endYear={chart.scatter.endYear} onStartDrag={this.onTimelineStart} onStopDrag={this.onTimelineStop}/>
        } else {
            return <Timeline years={chart.lineChart.timelineYears} onTargetChange={this.onScatterTargetChange} startYear={chart.lineChart.startYear} endYear={chart.lineChart.endYear} onStartDrag={this.onTimelineStart} onStopDrag={this.onTimelineStop}/>
        }
    }
}

export class Controls {
    props: { chart: ChartConfig, chartView: ChartView, width: number }
    constructor(props: { chart: ChartConfig, chartView: ChartView, width: number }) {
        this.props = props
    }

    @observable isShareMenuActive: boolean = false
    @observable isSettingsMenuActive: boolean = false

    @computed get addDataTerm() {
        const { chart } = this.props
        return chart.data.isSingleEntity ? "data" : chart.entityType
    }

    @computed get hasTimeline(): boolean {
        const {chart} = this.props
        if (chart.tab === 'map' && chart.map.data.hasTimeline)
            return true
        else if (chart.tab === 'chart' && (chart.isTimeScatter || chart.isScatter) && chart.scatter.hasTimeline)
            return true
        else if (chart.tab === 'chart' && chart.isLineChart)
            return true
        else
            return false
    }

    @computed get hasInlineControls(): boolean {
        const {chart} = this.props
        return chart.tab === 'chart' && (chart.data.canAddData || chart.isScatter || chart.data.canChangeEntity || (chart.isStackedArea && chart.stackedArea.canToggleRelative))
    }

    @computed get hasSettingsMenu(): boolean {
        return this.props.chart.tab === 'map'
    }

    @computed get hasSpace(): boolean {
        return this.props.width > 700
    }

    @computed get numLines(): number {
        let numLines = 1
        if (this.hasTimeline) numLines += 1
        if (this.hasInlineControls) numLines += 1
        if (this.hasSpace && numLines > 1) numLines -= 1
        return numLines
    }

    @computed get height(): number {
        return this.numLines*40
    }
}

@observer
export class ControlsFooterView extends React.Component<{ controls: Controls }> {
    @action.bound onShareMenu() {
        this.props.controls.isShareMenuActive = !this.props.controls.isShareMenuActive
    }

    @action.bound onSettingsMenu() {
        this.props.controls.isSettingsMenuActive = !this.props.controls.isSettingsMenuActive
    }

    @action.bound onDataSelect() {
        this.props.controls.props.chartView.isSelectingData = true
    }

    render() {
        const { props } = this
        const {isShareMenuActive, isSettingsMenuActive, hasSettingsMenu, hasTimeline, hasInlineControls, addDataTerm, hasSpace} = props.controls
        const {chart, chartView} = props.controls.props

        const tabs = <nav className="tabs">
            <ul>
                {chart.availableTabs.map(tabName => {
                    return tabName !== 'download' && <li key={tabName} className={"tab clickable" + (tabName === chart.tab ? ' active' : '')} onClick={() => chart.tab = tabName}><a>{tabName}</a></li>
                })}
                <li className={"tab clickable icon" + (chart.tab === 'download' ? ' active' : '')} onClick={() => chart.tab = 'download'} title="Download as .png or .svg">
                    <a><FontAwesomeIcon icon={faDownload}/></a>
                </li>
                <li className="clickable icon">
                    <a title="Share" onClick={this.onShareMenu}><FontAwesomeIcon icon={faShareAlt}/></a>
                </li>
                {hasSettingsMenu && <li className="clickable icon">
                    <a title="Settings" onClick={this.onSettingsMenu}><FontAwesomeIcon icon={faCog}/></a>
                </li>}
                {chart.isEmbed && <li className="clickable icon">
                    <a title="Open chart in new tab" href={chart.url.canonicalUrl} target="_blank"><FontAwesomeIcon icon={faExpand}/></a>
                </li>}
            </ul>
        </nav>

        const timeline = hasTimeline && <TimelineControl chart={chart}/>

        const extraControls = hasInlineControls && <div className="extraControls">
            {chart.data.canAddData && <button type="button" onClick={this.onDataSelect}>
                {(chart.isScatter || chart.isSlopeChart) ? <span><FontAwesomeIcon icon={faSearch}/> Search</span> : <span><FontAwesomeIcon icon={faPlus}/> Add {addDataTerm}</span>}
            </button>}

            {chart.data.canChangeEntity && <button type="button" onClick={this.onDataSelect}>
                <FontAwesomeIcon icon={faExchangeAlt}/> Change {chart.entityType}
            </button>}

            {chart.isScatter && chart.highlightToggle && <HighlightToggle chart={chart} highlightToggle={chart.highlightToggle} />}
            {chart.isStackedArea && chart.stackedArea.canToggleRelative && <AbsRelToggle chart={chart} />}
            {chart.isScatter && chart.scatter.canToggleRelative && <AbsRelToggle chart={chart} />}
            {/* {chart.isLineChart && chart.lineChart.canToggleRelative && <AbsRelToggle chart={chart} />} */}
        </div>

        return <div className="ControlsFooter" style={{ height: props.controls.height }}>
            {hasTimeline && (hasInlineControls || !hasSpace) && <div className="footerRowSingle">
                {timeline}
            </div>}
            {hasInlineControls && !hasSpace && <div className="footerRowSingle">
                {extraControls}
            </div>}
            {hasSpace && <div className="footerRowMulti">
                <div>
                    {hasInlineControls ? extraControls : timeline}
                </div>
                {tabs}
            </div>}
            {!hasSpace && <div className="footerRowSingle">
                {tabs}
            </div>}
            {isShareMenuActive && <ShareMenu chartView={chartView} chart={chart} onDismiss={this.onShareMenu} />}
            {isSettingsMenuActive && <SettingsMenu chart={chart} onDismiss={this.onSettingsMenu}/>}
        </div>
    }
}
