import { SiteSearchResults, PostHit, ChartHit } from "site/siteSearch"
import { observer } from "mobx-react"
import { computed } from "mobx"
import React = require("react")
import { EmbedChart } from "./EmbedChart";
import { BAKED_GRAPHER_URL } from "settings";

class ChartResult extends React.Component<{ hit: ChartHit }> {
    render() {
        const {hit} = this.props
        return <li className="ChartResult">
            {/* <a href={`${BAKED_GRAPHER_URL}/${hit.slug}`} dangerouslySetInnerHTML={{__html: hit._highlightResult.title.value}}/> */}
            <a href={`${BAKED_GRAPHER_URL}/${hit.slug}`}>{hit.title}</a>
            {hit.variantName ? <span className="chartVariantName"> {hit.variantName}</span> : undefined}
            {hit.subtitle ? <p dangerouslySetInnerHTML={{ __html: hit._snippetResult.subtitle.value }}/> : undefined}
        </li>
    }
}

@observer
export class SearchResults extends React.Component<{ results: SiteSearchResults }> {
    @computed get bestChartSlug() {
        return this.props.results.charts.length ? this.props.results.charts[0].slug : undefined
    }

    @computed get entries() {
        return this.props.results.posts.filter(p => p.postType === 'page')
    }

    @computed get blogposts() {
        return this.props.results.posts.filter(p => p.postType === 'post')
    }

    render() {
        const {results} = this.props

        return <div className="SearchResults">
            <div className="container">
                <div className="postResults">
                    <h2>Articles</h2>
                    <ul>
                        {results.posts.map(hit => <li key={hit.postId}>
                            {/* <a href={`/${hit.slug}`} dangerouslySetInnerHTML={{__html: hit._highlightResult.title.value}}/> */}
                            <a href={`/${hit.slug}`}>{hit.title}</a>
                            <p dangerouslySetInnerHTML={{__html: hit._snippetResult.content.value}}/>
                        </li>)}
                    </ul>
                </div>
                <div className="chartResults">
                    <h2>Data</h2>
                    {this.bestChartSlug && <EmbedChart src={`${BAKED_GRAPHER_URL}/${this.bestChartSlug}`}/>}
                    <ul>
                        {results.charts.map(hit => <ChartResult key={hit.chartId} hit={hit}/>)}
                    </ul>
                </div>
            </div>
        </div>
    }
}