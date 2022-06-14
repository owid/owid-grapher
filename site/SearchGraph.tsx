import React, { useEffect, useRef, useState } from "react"
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
import { faSearch } from "@fortawesome/free-solid-svg-icons/faSearch"

export const ALGOLIA_GRAPH_INDEX = "graph"
const algoliaClient = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)

export const SearchGraph = ({
    galleryId,
    gallery,
    defaultTopicTrail,
}: {
    galleryId: string
    gallery: GlightboxApi
    defaultTopicTrail?: string
}) => {
    const [showSearch, setShowSearch] = useState(false)
    const searchGraphRef = useRef<HTMLDivElement>(null)

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
                />
            </div>
        )
    }

    // Hide default key chart selection when opening search
    useEffect(() => {
        const contentGraphSearchEl =
            searchGraphRef.current?.parentElement?.nextElementSibling
        if (showSearch) {
            contentGraphSearchEl?.classList.add("hide")
        } else {
            contentGraphSearchEl?.classList.remove("hide")
        }
    }, [showSearch])

    return (
        <div ref={searchGraphRef}>
            <button
                className="toggle"
                onClick={() => setShowSearch(!showSearch)}
            >
                <FontAwesomeIcon icon={showSearch ? faTimes : faSearch} />
                {showSearch ? "Close" : "Open"}
            </button>
            {showSearch && (
                <InstantSearch
                    searchClient={algoliaClient}
                    indexName={ALGOLIA_GRAPH_INDEX}
                    initialUiState={{
                        [ALGOLIA_GRAPH_INDEX]: {
                            hierarchicalMenu: {
                                "topics.lvl0": [defaultTopicTrail ?? ""],
                            },
                        },
                    }}
                    onStateChange={({ uiState, setUiState }) => {
                        setUiState(uiState)
                        // Hack: reload the gallery after UI update
                        setTimeout(() => gallery.reload(), 50)
                    }}
                >
                    <SearchBox />

                    <div className="menu-hits">
                        <div className="menu">
                            <h4>Topics</h4>
                            <HierarchicalMenu
                                attributes={[
                                    "topics.lvl0",
                                    "topics.lvl1",
                                    "topics.lvl2",
                                ]}
                                limit={1}
                                showMore
                                sortBy={["isRefined"]}
                            />
                            <h4>Type</h4>
                            <RefinementList attribute="type" />
                        </div>
                        <div className={galleryId}>
                            <Hits hitComponent={Hit} />
                        </div>
                    </div>
                </InstantSearch>
            )}
        </div>
    )
}

export function runSearchGraph() {
    const searchElements = document.querySelectorAll(".wp-block-search-graph")
    searchElements.forEach((element, idx) => {
        // The separator between topics in topic trails is ">" in Algolia
        // hierarchical menu. When used in an HTML attribute, this closes the
        // current HTML tag prematurely, hence the replacement separator "::".
        // In a future version of the block, topic trails might be defined more
        // semantically in Wordpress or come from the content graph (as opposed
        // to hardcoded in the HTML markup).
        const defaultTopicTrail = element
            .getAttribute("data-default-topic")
            ?.replaceAll(/\s*::\s*/g, " > ")
        const galleryId = `search-graph-${idx}`
        const gallery = Glightbox({
            selector: `.${galleryId} .${PROMINENT_LINK_CLASSNAME} a `,
        })
        ReactDOM.render(
            <SearchGraph
                galleryId={galleryId}
                gallery={gallery}
                defaultTopicTrail={defaultTopicTrail}
            />,
            element
        )
    })
}
