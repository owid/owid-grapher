import React from "react"
import { useHits } from "react-instantsearch-hooks-web"
import { pick, RelatedChart } from "@ourworldindata/utils"
import { RelatedCharts } from "./blocks/RelatedCharts.js"

type AlgoliaHit = {
    title: string
    slug: string
}

export const SearchChartsHits = () => {
    const { hits } = useHits<AlgoliaHit>()
    if (!hits?.length) return null

    const charts: RelatedChart[] = hits.map((hit) =>
        pick(hit, ["title", "slug"])
    )

    return (
        <>
            <h3>Interactive charts</h3>
            <div className="SearchChartsHits">
                <RelatedCharts charts={charts} />
            </div>
        </>
    )
}
