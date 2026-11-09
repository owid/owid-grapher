import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faDiceFive } from "@fortawesome/free-solid-svg-icons"
import { useEffect, useState } from "react"
import { shouldShowStaffControls } from "@ourworldindata/grapher"

/**
 * Staff-only: searches for a random real query, to see search the way readers
 * use it.
 *
 * RANDOM_SEARCHES_URL is a list of searches drawn by volume with replacement,
 * so picking one uniformly samples a search by how often people make it. It
 * holds real people's queries, so it's never committed or deployed: someone
 * uploads it by hand to a server only staff can reach (Labs, a staging
 * server), and without it the button doesn't render.
 */
const RANDOM_SEARCHES_URL = "/random-searches.json"

// Fetched once per page load: the search bar re-mounts on every query
let randomSearches: Promise<string[] | undefined> | undefined

function loadRandomSearches(): Promise<string[] | undefined> {
    randomSearches ??= fetch(RANDOM_SEARCHES_URL)
        .then(async (response) => {
            if (!response.ok) return undefined
            const { queries } = (await response.json()) as {
                queries?: unknown
            }
            return Array.isArray(queries) &&
                queries.length > 0 &&
                queries.every((q) => typeof q === "string")
                ? queries
                : undefined
        })
        .catch(() => undefined)
    return randomSearches
}

export const SearchRandomButton = ({
    onSearch,
}: {
    onSearch: (query: string) => void
}) => {
    const [queries, setQueries] = useState<string[]>()

    useEffect(() => {
        if (!shouldShowStaffControls()) return
        let cancelled = false
        void loadRandomSearches().then((loaded) => {
            if (!cancelled) setQueries(loaded)
        })
        return () => {
            cancelled = true
        }
    }, [])

    if (!queries) return null
    return (
        <button
            className="search-random-button"
            type="button"
            aria-label="Search for a random real query"
            title="Search for a random real query, drawn by how often people search it"
            onClick={() =>
                onSearch(queries[Math.floor(Math.random() * queries.length)])
            }
        >
            <FontAwesomeIcon icon={faDiceFive} />
        </button>
    )
}
