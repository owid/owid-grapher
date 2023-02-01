import React from "react"
import { useHits } from "react-instantsearch-hooks-web"
import { RelatedChart, Url } from "@ourworldindata/utils"
import { RelatedCharts } from "./blocks/RelatedCharts.js"
import { setSelectedEntityNamesParam } from "@ourworldindata/grapher"
import { EmbedChart } from "./EmbedChart.js"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"

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

    return chartsToDisplay.length === 1 ? (
        <>
            <h3>Interactive chart</h3>
            <EmbedChart
                src={`${BAKED_BASE_URL}/grapher/${chartsToDisplay[0].slug}`}
                key={chartsToDisplay[0].slug}
                showSources={true}
            />
        </>
    ) : (
        <>
            <h3>Interactive charts</h3>
            <div className="SearchChartsHits">
                <RelatedCharts charts={chartsToDisplay} />
            </div>
        </>
    )
}
