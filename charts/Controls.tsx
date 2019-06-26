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
import { ADMIN_BASE_URL, ENV } from 'settings'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCode } from '@fortawesome/free-solid-svg-icons/faCode'
import { faEdit } from '@fortawesome/free-solid-svg-icons/faEdit'
import { faDownload } from '@fortawesome/free-solid-svg-icons/faDownload'
import { faShareAlt } from '@fortawesome/free-solid-svg-icons/faShareAlt'
import { faCog } from '@fortawesome/free-solid-svg-icons/faCog'
import { faExpand } from '@fortawesome/free-solid-svg-icons/faExpand'
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus'
import { faSearch } from '@fortawesome/free-solid-svg-icons/faSearch'
import { faExchangeAlt } from '@fortawesome/free-solid-svg-icons/faExchangeAlt'
import { faTwitter } from '@fortawesome/free-brands-svg-icons/faTwitter'
import { faFacebook } from '@fortawesome/free-brands-svg-icons/faFacebook'

type HorizontalAlign = 'left' | 'right'
type VerticalAlign = 'top' | 'middle' | 'bottom'

const DEFAULT_ADD_BUTTON_HEIGHT = 21

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
        return (Cookies.get('isAdmin') || ENV === "development") ? `${ADMIN_BASE_URL}/admin/charts/${this.props.chart.props.id}/edit` : undefined
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
            label = "Relative change"

        return <label className="clickable">
            <input type="checkbox" checked={chart.stackedArea.isRelative} onChange={this.onToggle} /> {label}
        </label>
    }
}

function boundRange(range: number[], start?: number, end?: number): number[] {
    return range.filter(n => {
        if (start !== undefined && n < start) return false
        if (end !== undefined && n > end) return false
        return true
    })
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
        const timelineMinTime = chart.props.timelineMinTime
        const timelineMaxTime = chart.props.timelineMaxTime
        if (chart.props.tab === 'map') {
            const {map} = chart
            return <Timeline
                years={boundRange(map.data.timelineYears, timelineMinTime, timelineMaxTime)}
                onTargetChange={this.onMapTargetChange}
                startYear={map.data.targetYear}
                endYear={map.data.targetYear}
                singleYearMode={true}
            />
        } else if (chart.isScatter) {
            return <Timeline
                years={boundRange(chart.scatter.timelineYears, timelineMinTime, timelineMaxTime)}
                onTargetChange={this.onScatterTargetChange}
                startYear={chart.scatter.startYear}
                endYear={chart.scatter.endYear}
                onStartDrag={this.onTimelineStart}
                onStopDrag={this.onTimelineStop}
            />
        } else if (chart.isLineChart) {
            console.log(chart.lineChart.isSingleYear)
            return <Timeline
                years={boundRange(chart.lineChart.timelineYears, timelineMinTime, timelineMaxTime)}
                onTargetChange={this.onScatterTargetChange}
                startYear={chart.lineChart.startYear}
                endYear={chart.lineChart.endYear}
                onStartDrag={this.onTimelineStart}
                onStopDrag={this.onTimelineStop}
                singleYearPlay={true}
            />
        } else {
            return <Timeline
                years={boundRange(chart.lineChart.timelineYears, timelineMinTime, timelineMaxTime)}
                onTargetChange={this.onScatterTargetChange}
                startYear={chart.lineChart.startYear}
                endYear={chart.lineChart.endYear}
                onStartDrag={this.onTimelineStart}
                onStopDrag={this.onTimelineStop}
            />
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

    addButtonHeight: number = DEFAULT_ADD_BUTTON_HEIGHT

    @observable addButtonX?: number
    @observable addButtonY?: number
    @observable addButtonAlign?: HorizontalAlign
    @observable addButtonVerticalAlign?: VerticalAlign

    @computed get addDataTerm() {
        const { chart } = this.props
        return chart.data.isSingleEntity ? "data" : chart.entityType
    }

    @computed get addButtonLabel() {
        return `Add ${this.addDataTerm}`
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
        return chart.tab === 'chart' && (
            (chart.data.canAddData && !this.hasAddButton) ||
            chart.isScatter ||
            chart.data.canChangeEntity ||
            (chart.isStackedArea && chart.stackedArea.canToggleRelative) ||
            (chart.isLineChart && chart.lineChart.canToggleRelative)
        )
    }

    @computed get hasSettingsMenu(): boolean {
        return this.props.chart.tab === 'map'
    }

    @computed get hasSpace(): boolean {
        return this.props.width > 700
    }

    @computed get hasAddButton(): boolean {
        const { chart } = this.props
        return chart.tab === "chart" && chart.data.canAddData && (chart.isLineChart || chart.isStackedArea || chart.isDiscreteBar)
    }

    @computed get footerLines(): number {
        let numLines = 1
        if (this.hasTimeline) numLines += 1
        if (this.hasInlineControls) numLines += 1
        if (this.hasSpace && numLines > 1) numLines -= 1
        return numLines
    }

    @computed get controlsPaddingTop(): number {
        if (this.addButtonY !== undefined && this.addButtonHeight > this.addButtonY) {
            return this.addButtonHeight - this.addButtonY
        } else {
            return 0
        }
    }

    @computed get footerHeight(): number {
        return this.footerLines*40
    }

    setAddButtonPosition({ x, y, align='left', verticalAlign='bottom', height=DEFAULT_ADD_BUTTON_HEIGHT}: { x: number, y: number, align?: HorizontalAlign, verticalAlign?: VerticalAlign, height?: number }) {
        this.addButtonX = x
        this.addButtonY = y
        this.addButtonAlign = align
        this.addButtonVerticalAlign = verticalAlign
        this.addButtonHeight = height
    }
}

@observer
export class ControlsOverlayView extends React.Component<{ controls: Controls }> {
    @action.bound onDataSelect() {
        this.props.controls.props.chartView.isSelectingData = true
    }

    render() {
        const { controls } = this.props
        const wrapperStyle: React.CSSProperties = {
            height: `${controls.controlsPaddingTop}px`,
            position: 'relative',
            width: '1px'
        }
        return <div className="ControlsOverlay" style={wrapperStyle}>
            {this.renderAddButton()}
        </div>
    }

    renderAddButton() {
        const { controls } = this.props
        if (controls.hasAddButton && controls.addButtonY !== undefined && controls.addButtonX !== undefined) {

            const buttonStyle: React.CSSProperties = {
                position: "absolute",
                lineHeight: `${controls.addButtonHeight}px`
            }

            if (controls.addButtonVerticalAlign === 'top') {
                buttonStyle.top = `${controls.addButtonY}px`
            } else if (controls.addButtonVerticalAlign === 'bottom') {
                buttonStyle.bottom = `${-controls.addButtonY}px`
            } else {
                buttonStyle.top = `${controls.addButtonY - controls.addButtonHeight / 2}px`
            }

            if (controls.addButtonAlign === 'left') {
                buttonStyle.left = `${controls.addButtonX}px`
            } else if (controls.addButtonAlign === 'right') {
                buttonStyle.right = `${-controls.addButtonX}px`
            }

            return <button className="addDataButton clickable" onClick={this.onDataSelect} style={buttonStyle}>
                <span className="icon">
                    <svg width={16} height={16}>
                        <path d="M3,8 h10 m-5,-5 v10" />
                    </svg>
                </span>
                <span className="label">{this.props.controls.addButtonLabel}</span>
            </button>
        }
        return null
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
        const {isShareMenuActive, isSettingsMenuActive, hasSettingsMenu, hasTimeline, hasInlineControls, hasAddButton, hasSpace} = props.controls
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
            {chart.data.canAddData && !hasAddButton && <button type="button" onClick={this.onDataSelect}>
                {(chart.isScatter || chart.isSlopeChart) ? <span><FontAwesomeIcon icon={faSearch}/> Search</span> : <span><FontAwesomeIcon icon={faPlus}/> {this.props.controls.addButtonLabel}</span>}
            </button>}

            {chart.data.canChangeEntity && <button type="button" onClick={this.onDataSelect}>
                <FontAwesomeIcon icon={faExchangeAlt}/> Change {chart.entityType}
            </button>}

            {chart.isScatter && chart.highlightToggle && <HighlightToggle chart={chart} highlightToggle={chart.highlightToggle} />}
            {chart.isStackedArea && chart.stackedArea.canToggleRelative && <AbsRelToggle chart={chart} />}
            {chart.isScatter && chart.scatter.canToggleRelative && <AbsRelToggle chart={chart} />}
            {chart.isLineChart && chart.lineChart.canToggleRelative && <AbsRelToggle chart={chart} />}
        </div>

        return <div className="ControlsFooter" style={{ height: props.controls.footerHeight }}>
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
