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

declare const Global: any
declare const App: any

@observer
class EmbedMenu extends React.Component<{ embedUrl: string }, null> {
    render() {
        const {embedUrl} = this.props

        return <div className="embedMenu" onClick={(evt) => evt.stopPropagation()}>
            <h2>Embed</h2>
            <p>Paste this into any HTML page:</p>
            <textarea onFocus={function(evt: any) { evt.target.select(); }}>
                {`<iframe src="${embedUrl}" style="width: 100%; height: 600px; border: 0px none;"></iframe>`}
            </textarea>
        </div>
    }
}

interface ShareMenuProps {
    config: ChartConfig,
    chartView: any,
    onDismiss: () => void
}

@observer
class ShareMenu extends React.Component<ShareMenuProps, null> {
    @computed get title() : string {
        return document.title.replace(" - Our World In Data", "")
    }

    @computed get baseUrl() : string {
        return Global.rootUrl + '/' + this.props.config.slug
    }

    @computed get queryStr() : string {
        return this.props.chartView.url.lastQueryStr||""
    }

    @computed get editUrl() : string {
        return Cookies.get('isAdmin') ? (Global.rootUrl + '/charts/' + this.props.chartView.model.get('id') + '/edit') : null
    }

    @observable isEmbedMenuActive : boolean = false

    embedMenu: any

    componentDidMount() {
        setTimeout(() => {
            d3.select(window).on('click.shareMenu', () => {
                if (this.embedMenu) {
                    ReactDOM.unmountComponentAtNode(this.props.chartView.overlayNode)
                    this.embedMenu = null
                }

                if (this.props.onDismiss)
                    this.props.onDismiss()
            })
        }, 50)
    }

    componentWillUnmount() {
        d3.select(window).on('click.shareMenu', null)
    }

    @action.bound onEmbed() {
        this.embedMenu = ReactDOM.render(<EmbedMenu embedUrl={this.baseUrl+this.queryStr} />, this.props.chartView.overlayNode)
    }

    render() {
        const {title, baseUrl, queryStr, editUrl, isEmbedMenuActive} = this

        return <div className="shareMenu" onClick={(evt) => evt.stopPropagation()}>
            <h2>Share</h2>
            <a className="btn" target="_blank" title="Tweet a link" href={"https://twitter.com/intent/tweet/?text=" + encodeURIComponent(title) + "&url=" + encodeURIComponent(baseUrl+queryStr)}>
                <i className="fa fa-twitter"/> Twitter
            </a>
            <a className="btn" target="_blank" title="Share on Facebook" href={"https://www.facebook.com/dialog/share?app_id=1149943818390250&display=page&href=" + encodeURIComponent(baseUrl+queryStr)}>
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
    config: ChartConfig,
    activeTabName: string,
    chartView: any
}

@observer
export default class ControlsFooter extends React.Component<ControlsFooterProps, null> {
    @computed get tabNames() : string[] {
        return this.props.config.availableTabs.concat(['download'])
    }

    @computed get height() {
        return Bounds.forText("CHART", { fontSize: 16*this.props.chartView.scale +'px' }).height*2/this.props.chartView.scale
    }

    @observable isShareMenuActive: boolean = false

    @action.bound onTabChange(tabName: string) {
        this.props.chartView.update({ activeTabName: tabName })
    }

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

    render() {
        const {props, tabNames, isShareMenuActive} = this
        return <div className="controlsFooter">
            <nav className="tabs">
                <ul>
                    {_.map(tabNames, (tabName) => {
                        return <li className={"tab clickable" + (tabName == props.activeTabName ? ' active' : '')} onClick={() => this.onTabChange(tabName)}><a>{tabName == 'download' ? <i className="fa fa-download"/> : tabName}</a></li>
                    })}
                    {props.chartView.isEmbed && <li className="clickable"><a title="Open chart in new tab" href={this.linkUrl} target="_blank"><i className="fa fa-expand"/></a></li>}
                    <li className="clickable"><a title="Share" onClick={this.onShareMenu}><i className="fa fa-share-alt"/></a></li>
                </ul>
            </nav>
            {isShareMenuActive && <ShareMenu chartView={this.props.chartView} config={this.props.config} onDismiss={() => this.isShareMenuActive = false}/>}
        </div>
    }
}
