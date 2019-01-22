import * as React from 'react'
import { observable, computed, autorun, action, runInAction } from 'mobx'
import { observer } from 'mobx-react'
import * as algoliasearch from 'algoliasearch'
import { ALGOLIA_ID, ALGOLIA_SEARCH_KEY, BAKED_GRAPHER_URL } from 'settings'
import { EmbedChart } from 'site/client/EmbedChart'

interface PostHit {
    slug: string
    title: string
    content: string
    excerpt: string
    _highlightResult: any
}

interface ChartHit {
    slug: string
    title: string
    _highlightResult: any
}

interface Results {
    posts: PostHit[]
    charts: ChartHit[]
}

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
class SearchResults extends React.Component<{ results: Results }> {
    @computed get bestChartSlug() {
        return this.props.results.charts.length ? this.props.results.charts[0].slug : undefined
    }

    componentDidMount() {
        document.body.style.overflowY = 'hidden'
    }

    componentWillUnmount() {
        document.body.style.overflowY = null
    }

    render() {
        const {results} = this.props
        return <div className="SearchResults">
            <div className="container">
                <div className="postResults">
                    <h2>Articles</h2>
                    {results.posts.map(hit => <PostResult key={hit.slug} hit={hit}/>)}
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
@observer
export class HeaderSearch extends React.Component {
    @observable.ref results?: Results
    lastQuery: string

    async runSearch(query: string) {
        const algolia = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)
        const json = await algolia.search([
            { indexName: 'mispydev_owid_articles', query: query, params: { distinct: true } },
            { indexName: 'mispydev_owid_charts', query: query, params: {} }
        ])

        if (this.lastQuery !== query) {
            // Don't need this result anymore
            return
        }

        runInAction(() => {
            this.results = {
                posts: json.results[0].hits,
                charts: json.results[1].hits
            }    
        })
    }

    @action.bound onSearch(e: React.ChangeEvent<HTMLInputElement>) {
        const value = e.currentTarget.value
        if (value) {
            this.lastQuery = value
            this.runSearch(value)
        } else {
            this.results = undefined
        }
    }

    render() {
        const {results} = this
        return <form id="search-nav">
            <input type="search" onChange={e => this.onSearch(e)} autoFocus/>
            {results && <SearchResults results={results}/>}
        </form>
    }
}