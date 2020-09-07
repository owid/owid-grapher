import { FORCE_EXPLORABLE_CHART_IDS, isExplorable } from "./IndicatorUtils"
import { GrapherInterface } from "grapher/core/GrapherInterface"
import { Indicator } from "./Indicator"
import * as db from "db/db"

export async function renderExplorableIndicatorsJson() {
    const query: { id: number; config: any }[] = await db.query(
        `
        SELECT id, config
        FROM charts
        WHERE charts.isExplorable
        ${FORCE_EXPLORABLE_CHART_IDS.length ? `OR charts.id IN (?)` : ""}
        `,
        [FORCE_EXPLORABLE_CHART_IDS]
    )

    const explorableCharts = query
        .map(chart => ({
            id: chart.id,
            config: JSON.parse(chart.config) as GrapherInterface
        }))
        // Ensure config is consistent with the current "explorable" requirements
        .filter(chart => isExplorable(chart.config))

    const result: Indicator[] = explorableCharts.map(chart => ({
        id: chart.id,
        title: chart.config.title,
        subtitle: chart.config.subtitle,
        sourceDesc: chart.config.sourceDesc,
        note: chart.config.note,
        dimensions: chart.config.dimensions,
        map: chart.config.map
    }))

    return JSON.stringify({ indicators: result })
}
