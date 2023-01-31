import React from "react"
import { useHits } from "react-instantsearch-hooks-web"
import { RelatedChart, Url } from "@ourworldindata/utils"
import { RelatedCharts } from "./blocks/RelatedCharts.js"
import { setSelectedEntityNamesParam } from "@ourworldindata/grapher"

export type ChartHit = {
    title: string
    slug: string
}

export const SearchChartsHits = ({
    entities,
    charts,
}: {
    entities: string[]
    charts?: ChartHit[]
}) => {
    const { hits } = useHits<ChartHit>()
    if (!hits?.length && !charts?.length) return null

    const chartsToDisplay: RelatedChart[] = (
        charts?.length ? charts : hits
    ).map(({ title, slug }) => {
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
                <RelatedCharts charts={chartsToDisplay} />
            </div>
        </>
    )
}
