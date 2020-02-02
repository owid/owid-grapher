import { faSearch } from "@fortawesome/free-solid-svg-icons/faSearch"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { action, observable, runInAction } from "mobx"
import { observer } from "mobx-react"
import * as React from "react"
import { siteSearch, SiteSearchResults } from "site/siteSearch"

import { SearchResults } from "./SearchResults"

class HeaderSearchResults extends React.Component<{
    results: SiteSearchResults
}> {
    componentDidMount() {
        document.body.style.overflowY = "hidden"
    }

    componentWillUnmount() {
        document.body.style.overflowY = ""
    }

    render() {
        return <SearchResults results={this.props.results} />
    }
}

@observer
export class HeaderSearch extends React.Component<{ autoFocus?: boolean }> {
    @observable.ref results?: SiteSearchResults
    lastQuery?: string

    async runSearch(query: string) {
        const results = await siteSearch(query)

        if (this.lastQuery !== query) {
            // Don't need this result anymore
            return
        }

        runInAction(() => (this.results = results))
    }

    @action.bound onSearch(e: React.ChangeEvent<HTMLInputElement>) {
        const value = e.currentTarget.value
        this.lastQuery = value
        if (value) {
            this.runSearch(value)
        } else {
            this.results = undefined
        }
    }

    render() {
        const { results } = this
        return (
            <form action="/search" method="GET" className="HeaderSearch">
                <input
                    type="search"
                    name="q"
                    onChange={e => this.onSearch(e)}
                    placeholder="Search..."
                    autoFocus={this.props.autoFocus}
                />
                <div className="icon">
                    <FontAwesomeIcon icon={faSearch} />
                </div>
                {results && <HeaderSearchResults results={results} />}
            </form>
        )
    }
}
