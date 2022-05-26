import React, { useEffect, useState } from "react"
import algoliasearch from "algoliasearch/lite"
import {
    HierarchicalMenu,
    Hits,
    InstantSearch,
    SearchBox,
} from "react-instantsearch-hooks-web"
import ReactDOM from "react-dom"
import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
    BAKED_GRAPHER_URL,
} from "../settings/clientSettings.js"
import { ProminentLink, ProminentLinkStyles } from "./blocks/ProminentLink.js"

export const ALGOLIA_GRAPH_INDEX = "graph"
const searchClient = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)

export const SearchGraph = () => {
    const [showHits, setShowHits] = useState(false)

    return (
        <InstantSearch
            searchClient={searchClient}
            indexName={ALGOLIA_GRAPH_INDEX}
        >
            <SearchBox onFocus={() => setShowHits(true)} />
            {showHits ? (
                <div className="menu-hits">
                    <HierarchicalMenu
                        attributes={[
                            "topics.lvl0",
                            "topics.lvl1",
                            "topics.lvl2",
                        ]}
                    />
                    <Hits hitComponent={Hit} />
                </div>
            ) : null}
        </InstantSearch>
    )
}

const Hit = ({ hit }: { hit: { image: string; title: string } }) => {
    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        window.GLightbox()
    }, [])

    if (!hit.image) return null
    const match = hit.image.match(/([^\/]+)\.svg/)
    if (!match?.length) return null

    return (
        <div>
            <ProminentLink
                href={`${BAKED_GRAPHER_URL}/${match[1]}`}
                style={ProminentLinkStyles.default}
                title={hit.title}
                content={hit.title}
                image={`<figure>
                        <img src="${hit.image}" />
                    </figure>`}
            />{" "}
        </div>
    )
}

export function runSearchGraph() {
    const searchElements = document.querySelectorAll(".wp-block-search-graph")
    searchElements.forEach((element) => {
        // const project = element.getAttribute("data-project")
        ReactDOM.render(<SearchGraph />, element)
    })
}
