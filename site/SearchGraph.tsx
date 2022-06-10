import React, { useState } from "react"
import algoliasearch from "algoliasearch/lite"
import {
    HierarchicalMenu,
    Hits,
    InstantSearch,
    RefinementList,
    SearchBox,
} from "react-instantsearch-hooks-web"
import ReactDOM from "react-dom"
import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
    BAKED_GRAPHER_URL,
} from "../settings/clientSettings.js"
import {
    ProminentLink,
    ProminentLinkStyles,
    PROMINENT_LINK_CLASSNAME,
} from "./blocks/ProminentLink.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes"
import Glightbox, { GlightboxApi } from "glightbox"

export const ALGOLIA_GRAPH_INDEX = "graph"
const searchClient = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)

export const SearchGraph = ({
    galleryId,
    gallery,
}: {
    galleryId: string
    gallery: GlightboxApi
}) => {
    const [showHits, setShowHits] = useState(false)

    const Hit = ({ hit }: { hit: { image: string; title: string } }) => {
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
                    gallery={gallery}
                    galleryId={galleryId}
                />
            </div>
        )
    }

    return (
        <InstantSearch
            searchClient={searchClient}
            indexName={ALGOLIA_GRAPH_INDEX}
            onStateChange={({ uiState, setUiState }) => {
                setUiState(uiState)
                // Hack to reload the gallery after UI update
                setTimeout(() => gallery.reload(), 50)
            }}
        >
            <div className="search-box-reset">
                <SearchBox onFocus={() => setShowHits(true)} />
                {showHits && (
                    <button
                        className="close"
                        onClick={() => setShowHits(false)}
                    >
                        <FontAwesomeIcon icon={faTimes} /> Close
                    </button>
                )}
            </div>
            {showHits && (
                <div className="menu-hits">
                    <div className="menu">
                        <h4>Topics</h4>
                        <HierarchicalMenu
                            attributes={[
                                "topics.lvl0",
                                "topics.lvl1",
                                "topics.lvl2",
                            ]}
                        />
                        <h4>Type</h4>
                        <RefinementList attribute="type" />
                    </div>
                    <Hits classNames={{ list: galleryId }} hitComponent={Hit} />
                </div>
            )}
        </InstantSearch>
    )
}

export function runSearchGraph() {
    const searchElements = document.querySelectorAll(".wp-block-search-graph")
    searchElements.forEach((element, idx) => {
        // const project = element.getAttribute("data-project")
        const galleryId = `search-graph-${idx}`
        const gallery = Glightbox({
            selector: `.${galleryId} .${PROMINENT_LINK_CLASSNAME} a `,
        })
        ReactDOM.render(
            <SearchGraph galleryId={galleryId} gallery={gallery} />,
            element
        )
    })
}
