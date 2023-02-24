import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faSearch } from "@fortawesome/free-solid-svg-icons/faSearch"
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark"
import classnames from "classnames"
import { SiteNavigationToggle } from "./SiteNavigationToggle.js"
import { siteSearch } from "./search/searchClient.js"
import { SearchResults } from "./search/SearchResults.js"
import { SiteSearchResults } from "./search/searchTypes.js"

export const SiteSearchInput = ({
    query,
    setQuery,
}: {
    query: string
    setQuery: (query: string) => void
}) => {
    const [results, setResults] = React.useState<SiteSearchResults | null>(null)

    // Run search
    React.useEffect(() => {
        const runSearch = async () => {
            if (query) {
                setResults(await siteSearch(query))
            } else {
                setResults(null)
            }
        }
        runSearch()
    }, [query])

    return (
        <>
            <form
                className={classnames("SiteSearchInput", { active: query })}
                action="/search"
                method="GET"
            >
                <input
                    name="search"
                    placeholder="Search for a topic or chart..."
                    onChange={(e) => setQuery(e.currentTarget.value)}
                    className={classnames({ active: query })}
                    value={query}
                />
                <div className="icon">
                    {query ? (
                        <SiteNavigationToggle
                            toggle={() => setQuery("")}
                            isActive={true}
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </SiteNavigationToggle>
                    ) : (
                        <FontAwesomeIcon icon={faSearch} />
                    )}
                </div>
            </form>
            {results && <SearchResults results={results} />}
        </>
    )
}
