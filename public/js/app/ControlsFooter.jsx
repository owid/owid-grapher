// @flow

import * as _ from 'underscore'
import * as d3 from 'd3'
import owid from '../owid'
import Bounds from './Bounds'
import Text from './Text'
import type { SVGElement } from './Util'
import React, {Component} from 'react'
import {render} from 'preact'
import { observable, computed, asFlat, autorun, autorunAsync, action } from 'mobx'
import {observer} from 'mobx-react'
import { bind } from 'decko'
import * as Cookies from 'js-cookie'
import ChartConfig from './ChartConfig'
import {NullElement} from './Util'

@observer
class EmbedMenu extends Component {
    render() {
        const {embedUrl} = this.props

        return <div class="embedMenu" onClick={(evt) => evt.stopPropagation()}>
            <h2>Embed</h2>
            <p>Paste this into any HTML page:</p>
            <textarea onFocus={function(evt) { evt.target.select(); }}>
                {`<iframe src="${embedUrl}" style="width: 100%; height: 600px; border: 0px none;"></iframe>`}
            </textarea>
        </div>
    }
}

@observer
class ShareMenu extends Component {
    @computed get title() : string {
        return document.title.replace(" - Our World In Data", "")
    }

    @computed get baseUrl() : string {
        return Global.rootUrl + '/' + this.props.config.slug
    }

    @computed get queryStr() : string {
        return chart.url.lastQueryStr||""
    }

    @computed get cacheTag() : string {
        return chart.model.get("variableCacheTag")
    }

    @computed get editUrl() : string {
        return Cookies.get('isAdmin') ? (Global.rootUrl + '/charts/' + chart.model.get('id') + '/edit') : null
    }

    @computed get pngUrl() : string {
        const {baseUrl, queryStr, cacheTag} = this
        var pngHref = baseUrl + '.png' + queryStr, defaultTargetSize = "1200x800"
        return pngHref + (_.include(pngHref, "?") ? "&" : "?") + "size=" + defaultTargetSize + "&v=" + cacheTag
    }

    @computed get svgUrl() : string {
        const {baseUrl, queryStr, cacheTag} = this
        var svgHref = baseUrl + '.svg' + queryStr, defaultTargetSize = "1200x800"
        return svgHref + (_.include(svgHref, "?") ? "&" : "?") + "size=" + defaultTargetSize + "&v=" + cacheTag
    }

    @observable isEmbedMenuActive : boolean = false

    embedMenu: any

    componentDidMount() {
        setTimeout(() => {
            d3.select(window).on('click.embedMenu', () => {
                if (this.embedMenu)
                    this.embedMenu = render(NullElement, chart.htmlNode, this.embedMenu)

                if (this.props.onDismiss)
                    this.props.onDismiss()
            })
        }, 50)
    }

    componentWillUnmount() {
        d3.select(window).on('click.embedMenu', null)
    }

    @bind @action onEmbed() {
        this.embedMenu = render(<EmbedMenu embedUrl={this.baseUrl+this.queryStr} />, chart.htmlNode, this.embedMenu)
    }

    render() {
        const {title, baseUrl, queryStr, editUrl, pngUrl, svgUrl, isEmbedMenuActive} = this

        return <div class="shareMenu" onClick={(evt) => evt.stopPropagation()}>
            <h2>Share</h2>
            <a class="btn" target="_blank" title="Link to visualization" href={baseUrl+queryStr}>
                <i class="fa fa-link"/> Link
            </a>
            <a class="btn" target="_blank" title="Tweet a link" href={"https://twitter.com/intent/tweet/?text=" + encodeURIComponent(title) + "&url=" + encodeURIComponent(baseUrl+queryStr)}>
                <i class="fa fa-twitter"/> Twitter
            </a>
            <a class="btn" target="_blank" title="Share on Facebook" href={"https://www.facebook.com/dialog/share?app_id=1149943818390250&display=page&href=" + encodeURIComponent(baseUrl+queryStr)}>
                <i class="fa fa-facebook"/> Facebook
            </a>
            <a class="btn" title="Embed this visualization in another HTML document" onClick={this.onEmbed}>
                <i class="fa fa-code"/> Embed
            </a>
            <a class="btn" target="_blank" title="Save visualization in raster format" href={pngUrl}>
                <i class="fa fa-download"/> Save as PNG
            </a>
            <a class="btn" target="_blank" title="Save visualization in vector graphics format" href={svgUrl}>
                <i class="fa fa-download"/> Save as SVG
            </a>
            {editUrl && <a class="btn" target="_blank" title="Edit chart" href={editUrl}>
                <i class="fa fa-edit"/> Edit
            </a>}
        </div>
    }
}

@observer
class ControlsFooter extends Component {
    props: {
        config: ChartConfig,
        activeTabName: activeTabName
    }

    @computed get tabNames() : string[] {
        return this.props.config.availableTabs
    }

    @computed get activeTabName() : string {
        return this.props.activeTabName
    }

    @computed get height() {
        return Bounds.forText("CHART", { fontSize: 16*chart.scale +'px' }).height*2/chart.scale
    }

    @observable isShareMenuActive : boolean = false

    @bind @action onTabChange(tabName) {
        chart.update({ activeTabName: tabName })
    }

    @bind @action onShareMenu() {
        this.isShareMenuActive = !this.isShareMenuActive
    }

    render() {
        const {tabNames, activeTabName, isShareMenuActive} = this
        return <div class="controlsFooter">
            <nav class="tabs">
                <ul>
                    {_.map(tabNames, (tabName) => {
                        return <li class={"tab clickable" + (tabName == activeTabName ? ' active' : '')} onClick={() => this.onTabChange(tabName)}><a>{tabName}</a></li>
                    })}
                    <li class="clickable"><a onClick={this.onShareMenu}><i class="fa fa-ellipsis-v"/></a></li>                    
                </ul>                
            </nav>
            {isShareMenuActive && <ShareMenu config={this.props.config} onDismiss={() => this.isShareMenuActive=false}/>}
        </div>
    }
}

export default function(chart) {
    var controlsFooter = owid.dataflow();

    let rootNode = null

    const config = new ChartConfig(chart.model)

    controlsFooter.render = function(bounds) {
        rootNode = render(<ControlsFooter config={config} activeTabName={chart.activeTabName} ref={(el) => controlsFooter.height = el.height}/>, chart.htmlNode, rootNode)
    };

    controlsFooter.beforeClean(function() {
        rootNode = render(NullElement, chart.htmlNode, rootNode);
    });

    return controlsFooter;
};