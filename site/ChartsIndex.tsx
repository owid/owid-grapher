import React, { useMemo, useState } from "react"
import ReactDOM from "react-dom"
import {
    Configure,
    Hits,
    InstantSearch,
    SearchBox,
    useInstantSearch,
} from "react-instantsearch"
import cx from "classnames"
import algoliasearch, { SearchClient } from "algoliasearch"
import { ALGOLIA_ID, ALGOLIA_SEARCH_KEY } from "../settings/clientSettings.js"
import { getIndexName } from "./search/searchClient.js"
import { SearchIndexName } from "./search/searchTypes.js"
import { BaseHit, Hit } from "instantsearch.js"
import { get } from "@ourworldindata/utils"

export interface ChartsIndexContainerProps {}

function HitComponent(props: {
    hit: Hit<BaseHit> & { title: string; slug: string }
}) {
    return (
        <div>
            <strong>
                <a href={`/grapher/${props.hit.slug}`}>{props.hit.title}</a>
            </strong>
        </div>
    )
}

function MetaBlockResults(props: { className?: string; tag: string }) {
    const { className, tag } = props
    const path = typeof window !== "undefined" ? window.location.pathname : ""
    const { results } = useInstantSearch()
    if (!results.hits.length) return null
    return (
        <div className={cx("charts-index-block", className)}>
            <h3>
                {tag}{" "}
                <a
                    style={{ fontSize: 14, color: "grey" }}
                    href={`${[...path.slice(0, -1).split("/"), tag].join("/")}`}
                >
                    See all &gt;
                </a>
            </h3>
            <Hits hitComponent={HitComponent} />
        </div>
    )
}

function MetaBlock(props: {
    searchClient: SearchClient
    tag: string
    query: string
    className?: string
}) {
    const { searchClient, tag, query, className } = props
    // get current path if window is defined
    return (
        <InstantSearch
            searchClient={searchClient}
            indexName={getIndexName(SearchIndexName.Charts)}
        >
            <Configure
                hitsPerPage={5}
                facetFilters={[`tags:${tag}`]}
                query={query}
            />
            <MetaBlockResults className={className} tag={tag} />
        </InstantSearch>
    )
}

const MOCK_TAG_HIERARCHY = {
    Energy: ["Nuclear Energy", "Access to Energy", "Land Use"],
    Poverty: ["Multidimensional Poverty"],
    "CO2 & Greenhouse Gas Emissions": [],
    Democracy: [],
    "Economic Growth": [],
    "COVID-19": [],
    "Child & Infant Mortality": [],
    "Burden of Disease": [],
    "Women's Rights": [],
    "Causes of Death": [],
}

const CATEGORIES = [
    "Causes of Death",
    "Energy",
    "CO2 & Greenhouse Gas Emissions",
    "Democracy",
    "Economic Growth",
    "COVID-19",
    "Child & Infant Mortality",
    "Burden of Disease",
    "Poverty",
    "Women's Rights",
]

export function ChartsIndexContainer(props: ChartsIndexContainerProps) {
    const searchClient = useMemo(
        () => algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY),
        []
    )
    const [query, setQuery] = useState("")
    const parentTags =
        typeof window !== "undefined"
            ? // (e.g. /charts/Energy/Nuclear Energy) => ["Energy", "Nuclear Energy"]
              decodeURIComponent(window.location.pathname)
                  .split("/")
                  .filter(Boolean)
                  .slice(1)
            : ""

    const tags: string[] = !parentTags.length
        ? Object.keys(MOCK_TAG_HIERARCHY)
        : parentTags.length === 1
          ? get(MOCK_TAG_HIERARCHY, parentTags[0])
          : [parentTags.at(-1)]

    return (
        <div className="span-cols-12 col-start-2">
            <h2 className="display-2-semibold span-cols-12">Data</h2>
            <input
                type="text"
                placeholder="Search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            <div className="grid">
                {tags.map((tag) => (
                    <MetaBlock
                        className="span-cols-6"
                        key={tag}
                        searchClient={searchClient}
                        tag={tag}
                        query={query}
                    />
                ))}
            </div>
        </div>
    )
}
export function runChartsIndexContainer() {
    const container = document.querySelector("main#charts-index-container")
    if (container) {
        ReactDOM.render(<ChartsIndexContainer />, container)
    }
}
