import React from "react"
import { observable, action, runInAction, makeObservable } from "mobx";
import { observer } from "mobx-react"
import { SearchResults } from "./SearchResults.js"
import { SiteSearchResults, siteSearch } from "./searchClient.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faSearch } from "@fortawesome/free-solid-svg-icons/faSearch"

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

export const HeaderSearch = observer(class HeaderSearch extends React.Component<{ autoFocus?: boolean }> {
    results?: SiteSearchResults;
    lastQuery?: string

    constructor(props: { autoFocus?: boolean }) {
        super(props);

        makeObservable(this, {
            results: observable.ref,
            onSearch: action.bound
        });
    }

    async runSearch(query: string) {
        const results = await siteSearch(query)

        if (this.lastQuery !== query) {
            // Don't need this result anymore
            return
        }

        runInAction(() => (this.results = results))
    }

    onSearch(e: React.ChangeEvent<HTMLInputElement>) {
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
                    onChange={(e) => this.onSearch(e)}
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
});
