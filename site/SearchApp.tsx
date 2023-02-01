import React, { useState } from "react"
import {
    Configure,
    Hits,
    Index,
    InstantSearch,
    RefinementList,
} from "react-instantsearch-hooks-web"
import { TopicCard } from "./TopicCard.js"
import { SearchClient } from "algoliasearch/lite.js"
import { VirtualChartsRefinementList } from "./VirtualChartsRefinementList.js"
import { ChartHit, SearchChartsHits } from "./SearchChartsHits.js"
import { SearchAutocomplete } from "./SearchAutocomplete.js"
import "instantsearch.css/themes/satellite.css"
import { SearchResearchAndWriting } from "./blocks/SearchResearchAndWriting.js"
import { SearchTopics } from "./SearchTopics.js"

export const PAGES_INDEX = "pages-test"
export const CHARTS_INDEX = "charts-test"

export const SearchApp = ({ searchClient }: { searchClient: SearchClient }) => {
    const [entities, setEntities] = useState<string[]>([])
    const [charts, setCharts] = useState<ChartHit[]>([])

    return (
        <div className="SearchApp">
            <InstantSearch
                indexName={PAGES_INDEX}
                searchClient={searchClient}
                routing
            >
                <div className="search-header">
                    <div style={{ textAlign: "center" }}>
                        <h2>Search Our World in Data</h2>
                        <div>Free, open and ad-free</div>
                    </div>
                </div>
                <div className="search-sticky-bar">
                    <SearchAutocomplete
                        placeholder=""
                        className="SearchAutocomplete"
                        detachedMediaQuery="none"
                        openOnFocus
                        searchClient={searchClient}
                        setEntities={setEntities}
                        setCharts={setCharts}
                    />
                </div>
                <div className="refinements">
                    <RefinementList attribute="_tags" />
                    {/* TODO <RefinementList attribute="authors" /> */}
                </div>
                <div className="search-results">
                    <Index indexName={PAGES_INDEX} indexId="topics">
                        <Configure
                            hitsPerPage={10}
                            filters="type:entry"
                            distinct={1}
                        />
                        <SearchTopics />
                    </Index>
                    <Index indexName={CHARTS_INDEX}>
                        <VirtualChartsRefinementList attribute="_tags" />
                        {/* TODO <VirtualChartsRefinementList attribute="availableEntities" /> */}
                        <SearchChartsHits charts={charts} entities={entities} />
                    </Index>
                    <Index indexName={PAGES_INDEX} indexId="research">
                        <Configure
                            hitsPerPage={9}
                            filters="(NOT type:entry) AND (NOT type:country)"
                            distinct={1}
                        />
                        <SearchResearchAndWriting />
                    </Index>
                </div>
            </InstantSearch>
        </div>
    )
}
