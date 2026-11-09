import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faDice } from "@fortawesome/free-solid-svg-icons"
import { useEffect, useState } from "react"
import { RANDOM_SEARCHES_URL } from "./rerank.js"

/**
 * Experimental, for trying out the rerank: searches for a random real query.
 * The list is a file of searches drawn by volume (so picking one uniformly
 * samples a search by how often people make it), uploaded to a staging
 * server by hand and never committed, since it holds real people's queries.
 * Without the file the button doesn't render.
 */

// Fetched once per page load: the search bar re-mounts on every query
let randomSearches: Promise<string[] | undefined> | undefined

function loadRandomSearches(): Promise<string[] | undefined> {
    randomSearches ??= RANDOM_SEARCHES_URL
        ? fetch(RANDOM_SEARCHES_URL)
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
        : Promise.resolve(undefined)
    return randomSearches
}

export const SearchRandomButton = ({
    onSearch,
}: {
    onSearch: (query: string) => void
}) => {
    const [queries, setQueries] = useState<string[]>()

    useEffect(() => {
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
            <FontAwesomeIcon icon={faDice} />
        </button>
    )
}
