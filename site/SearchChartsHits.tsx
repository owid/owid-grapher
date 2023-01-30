import React from "react"
import { useHits } from "react-instantsearch-hooks-web"
import { RelatedChart, Url } from "@ourworldindata/utils"
import { RelatedCharts } from "./blocks/RelatedCharts.js"
import { setSelectedEntityNamesParam } from "@ourworldindata/grapher"

type AlgoliaHit = {
    title: string
    slug: string
}

export const SearchChartsHits = ({ entities }: { entities: string[] }) => {
    const { hits } = useHits<AlgoliaHit>()
    if (!hits?.length) return null

    const charts: RelatedChart[] = hits.map(({ title, slug }) => {
        const chartSlugWithEntities = setSelectedEntityNamesParam(
            Url.fromURL(slug).updateQueryParams({
                tab: "chart",
            }),
            entities
        ).fullUrl
        return { title, slug: chartSlugWithEntities }
    })

    return (
        <>
            <h3>Interactive charts</h3>
            <div className="SearchChartsHits">
                <RelatedCharts charts={charts} />
            </div>
        </>
    )
}
