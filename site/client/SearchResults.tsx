import { SiteSearchResults, PostHit, ChartHit } from "site/siteSearch"
import { observer } from "mobx-react"
import { computed } from "mobx"
import React = require("react")
import { EmbedChart } from "./EmbedChart";
import { BAKED_GRAPHER_URL } from "settings";

class PostResult extends React.Component<{ hit: PostHit }> {
    render() {
        const {hit} = this.props
        return <div className="PostResult">
            <a href={`/${hit.slug}`}>{hit.title}</a>
            <p>{hit.excerpt}</p>
            {/* <a href={`/${hit.slug}`} dangerouslySetInnerHTML={{__html: hit._highlightResult.title.value}}/>
            <p dangerouslySetInnerHTML={{__html: hit._highlightResult.content.value}}/> */}
        </div>
    }
}

class ChartResult extends React.Component<{ hit: ChartHit }> {
    render() {
        const {hit} = this.props
        return <div className="ChartResult">
            <a href={`https://ourworldindata.org/grapher/${hit.slug}`}>{hit.title}</a>
        </div>
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
        const {entries, blogposts} = this

        return <div className="SearchResults">
            <div className="container">
                <div className="postResults">
                    <h2>Entries</h2>
                    <ul>
                        {entries.map(hit => <li key={hit.slug}>
                            <a href={`/${hit.slug}`}>{hit.title}</a>
                            <p>{hit.content}</p>
                        </li>)}
                    </ul>
                    <h2>Posts</h2>
                    <ul>
                        {blogposts.map(hit => <li key={hit.slug} className="PostResult">
                            <a href={`/${hit.slug}`}>{hit.title}</a>
                            <p>{hit.content}</p>
                            {/* <a href={`/${hit.slug}`} dangerouslySetInnerHTML={{__html: hit._highlightResult.title.value}}/>
                            <p dangerouslySetInnerHTML={{__html: hit._highlightResult.content.value}}/> */}
                        </li>)}
                    </ul>
                </div>
                <div className="chartResults">
                    <h2>Data</h2>
                    {this.bestChartSlug && <EmbedChart src={`${BAKED_GRAPHER_URL}/${this.bestChartSlug}`}/>}
                    {results.charts.map(hit => <ChartResult key={hit.slug} hit={hit}/>)}
                </div>
            </div>
        </div>
    }
}