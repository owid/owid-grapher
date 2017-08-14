import * as _ from 'lodash'
import * as d3 from 'd3'
import Bounds from './Bounds'
import Text from './Text'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { observable, computed, asFlat, autorun, autorunAsync, action } from 'mobx'
import {observer} from 'mobx-react'
import * as Cookies from 'js-cookie'
import ChartConfig from './ChartConfig'
import * as $ from 'jquery'
import ChartTabOption from './ChartTabOption'
import ChartType from './ChartType'
import {getQueryParams} from './Util'
import ChartView from './ChartView'
import {HighlightToggleConfig} from './ChartConfig'
import DataSelector from './DataSelector'

declare const Global: any
declare const App: any

@observer
class EmbedMenu extends React.Component<{ embedUrl: string }> {
    render() {
        const {embedUrl} = this.props

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
    @computed get title() : string {
        return document.title.replace(" - Our World In Data", "")
    }

    @computed get editUrl() : string|null {
        return Cookies.get('isAdmin') ? (Global.adminRootUrl + '/charts/' + this.props.chart.id + '/edit') : null
    }

    @computed get canonicalUrl(): string {
        return this.props.chart.url.canonicalUrl
    }

    @observable isEmbedMenuActive : boolean = false

    embedMenu: any

    componentDidMount() {
        setTimeout(() => {
            d3.select(window).on('click.shareMenu', () => {
                this.props.chartView.removePopup(EmbedMenu)

                if (this.props.onDismiss)
                    this.props.onDismiss()
            })
        }, 50)
    }

    componentWillUnmount() {
        d3.select(window).on('click.shareMenu', null)
    }

    @action.bound onEmbed() {
        this.props.chartView.addPopup(<EmbedMenu embedUrl={this.canonicalUrl}/>)
    }

    render() {
        const {title, editUrl, canonicalUrl, isEmbedMenuActive} = this

        return <div className="shareMenu" onClick={(evt) => evt.stopPropagation()}>
            <h2>Share</h2>
            <a className="btn" target="_blank" title="Tweet a link" href={"https://twitter.com/intent/tweet/?text=" + encodeURIComponent(title) + "&url=" + encodeURIComponent(canonicalUrl)}>
                <i className="fa fa-twitter"/> Twitter
            </a>
            <a className="btn" target="_blank" title="Share on Facebook" href={"https://www.facebook.com/dialog/share?app_id=1149943818390250&display=page&href=" + encodeURIComponent(canonicalUrl)}>
                <i className="fa fa-facebook"/> Facebook
            </a>
            <a className="btn" title="Embed this visualization in another HTML document" onClick={this.onEmbed}>
                <i className="fa fa-code"/> Embed
            </a>
            {editUrl && <a className="btn" target="_blank" title="Edit chart" href={editUrl}>
                <i className="fa fa-edit"/> Edit
            </a>}
        </div>
    }
}

interface ControlsFooterProps {
    chart: ChartConfig,
    chartView: ChartView,
}

class HighlightToggle extends React.Component<{ chart: ChartConfig, highlightToggle: HighlightToggleConfig }> {
    @computed get chart() { return this.props.chart }
    @computed get highlight() { return this.props.highlightToggle }

    @computed get highlightParams() {
        return getQueryParams((this.highlight.paramStr||"").substring(1))
    }

    @action.bound onHighlightToggle(e: React.FormEvent<HTMLInputElement>) {
        if (e.currentTarget.checked) {
            const params = getQueryParams()
            this.chart.url.populateFromURL(_.extend(params, this.highlightParams))
        } else {
            this.chart.data.selectedKeys = []
        }
    }

    get isHighlightActive() {
        const params = getQueryParams()
        let isActive = true
        _.keys(this.highlightParams).forEach((key) => {
            if (params[key] != this.highlightParams[key])
                isActive = false
        })
        return isActive
    }

    render() {
        const {highlight, isHighlightActive} = this
        return <label className="clickable HighlightToggle">
            <input type="checkbox" checked={isHighlightActive} onChange={this.onHighlightToggle}/> {highlight.description}
        </label>
    }
}

class AbsRelToggle extends React.Component<{ chart: ChartConfig }> {
    @action.bound onToggle() {
        const {stackedArea} = this.props.chart
        stackedArea.isRelative = !stackedArea.isRelative
    }

    render() {
        const {chart} = this.props
        return <label className="clickable">
            <input type="checkbox" checked={chart.stackedArea.isRelative} onChange={this.onToggle}/> Relative
        </label>
    }
}

@observer
export default class ControlsFooter extends React.Component<ControlsFooterProps> {
    @computed get height() {
        const height = Bounds.forText("CHART", { fontSize: 16*this.props.chartView.scale +'px' }).height*2
        if (this.props.chartView.isPortrait)
            return height*2
        else
            return height
    }

    @observable isShareMenuActive: boolean = false

    @action.bound onShareMenu() {
        this.isShareMenuActive = !this.isShareMenuActive
    }

    @observable linkUrl: string
    componentDidMount() {
        this.linkUrl = window.location.toString()
        $(window).on('query-change', () => {
            this.linkUrl = window.location.toString()
        })
    }

    @action.bound onDataSelect() {
        this.props.chartView.isSelectingData = true
    }

    render() {
        const {props, isShareMenuActive} = this
        const {chart, chartView} = props

        return <div className="controlsFooter">
            {chart.tab == 'chart' && <div className="extraControls">          
                {chart.data.availableKeys.length > 1 && <button onClick={this.onDataSelect}>
                    <i className="fa fa-plus"/> Add data
                </button>}
                {chart.type == ChartType.ScatterPlot && chart.highlightToggle && <HighlightToggle chart={chart} highlightToggle={chart.highlightToggle}/>}
                {chart.type == ChartType.StackedArea && <AbsRelToggle chart={chart}/>}
            </div>}
            <nav className="tabs">
                <ul>
                    {_.map(chart.availableTabs, (tabName) => {
                        return tabName != 'download' && <li className={"tab clickable" + (tabName == chart.tab ? ' active' : '')} onClick={() => chart.tab = tabName}><a>{tabName}</a></li>
                    })}
                    <li className={"tab clickable icon" + (chart.tab == 'download' ? ' active' : '')} onClick={() => chart.tab = 'download'} title="Download as .png or .svg">
                        <a><i className="fa fa-download"/></a>
                    </li>
                    <li className="clickable icon"><a title="Share" onClick={this.onShareMenu}><i className="fa fa-share-alt"/></a></li>
                    {props.chartView.isEmbed && <li className="clickable icon"><a title="Open chart in new tab" href={this.linkUrl} target="_blank"><i className="fa fa-expand"/></a></li>}
                </ul>
            </nav>
            {isShareMenuActive && <ShareMenu chartView={this.props.chartView} chart={this.props.chart} onDismiss={() => this.isShareMenuActive = false}/>}
        </div>
    }
}
