import React, { useEffect } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faSearch, faXmark } from "@fortawesome/free-solid-svg-icons"
import classnames from "classnames"
import { siteSearch } from "./search/searchClient.js"
import { SearchResults } from "./search/SearchResults.js"
import { SiteSearchResults } from "./search/searchTypes.js"

export const SiteSearchNavigation = ({
    query,
    setQuery,
    isActive,
    onClose,
    onActivate,
}: {
    query: string
    setQuery: (query: string) => void
    isActive: boolean
    onClose: VoidFunction
    onActivate: VoidFunction
}) => {
    const [results, setResults] = React.useState<SiteSearchResults | null>(null)
    const inputRef = React.useRef<HTMLInputElement>(null)

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

    // Focus input when active (needs to happen after render, hence useEffect)
    useEffect(() => {
        if (isActive && inputRef.current) {
            inputRef.current.focus()
        }
    }, [isActive])

    return (
        <>
            <div
                className={classnames("SiteSearchNavigation", {
                    active: isActive,
                })}
            >
                <input
                    name="search"
                    placeholder="Search for a topic or chart..."
                    onChange={(e) => setQuery(e.currentTarget.value)}
                    onFocus={onActivate}
                    className={classnames({ active: isActive })}
                    value={query}
                    ref={inputRef}
                />
                <div className="icon">
                    {isActive ? (
                        <button
                            onClick={(e) => {
                                e.preventDefault()
                                onClose()
                            }}
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    ) : (
                        <FontAwesomeIcon icon={faSearch} />
                    )}
                </div>
            </div>
            {!isActive && (
                <button
                    onClick={onActivate}
                    data-track-note="mobile-search-button"
                    className="SiteSearchNavigation__mobile-toggle hide-lg-up"
                >
                    <FontAwesomeIcon icon={faSearch} />
                </button>
            )}
            {isActive && results && <SearchResults results={results} />}
        </>
    )
}
