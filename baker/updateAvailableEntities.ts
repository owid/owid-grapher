import { Grapher } from "@ourworldindata/grapher"
import { GrapherInterface, GrapherTabOption } from "@ourworldindata/types"
import * as db from "../db/db.js"

const obtainAvailableEntitiesForGrapherConfig = async (
    grapherConfig: GrapherInterface
) => {
    const grapher = new Grapher({ ...grapherConfig })
    await grapher.downloadLegacyDataFromOwidVariableIds()

    // If the grapher has a chart tab, then the available entities there are the "most interesting" ones to us
    if (grapher.hasChartTab) {
        grapher.tab = GrapherTabOption.chart

        // If the grapher allows for changing or multi-selecting entities, then let's index all entities the
        // user can choose from. Otherwise, we'll just use the default-selected entities.
        const canChangeEntities =
            grapher.canChangeEntity || grapher.canSelectMultipleEntities

        if (canChangeEntities)
            return grapher.tableForSelection.availableEntityNames as string[]
        else return grapher.selectedEntityNames
    } else if (grapher.hasMapTab) {
        grapher.tab = GrapherTabOption.map
        // On a map tab, tableAfterAuthorTimelineAndActiveChartTransform contains all
        // mappable entities for which data is available
        return grapher.tableAfterAuthorTimelineAndActiveChartTransform
            .availableEntityNames as string[]
    } else return []
}

const updateAvailableEntitiesForAllGraphers = async (
    trx: db.KnexReadWriteTransaction
) => {
    const allGraphers = trx
        .select("id", "config")
        .from("charts")
        // .limit(10)
        .stream()

    for await (const grapher of allGraphers) {
        const config = JSON.parse(grapher.config) as GrapherInterface
        const availableEntities =
            await obtainAvailableEntitiesForGrapherConfig(config)

        console.log(grapher.id, config.slug)
    }
}

const main = async () => {
    await db.knexReadWriteTransaction(
        updateAvailableEntitiesForAllGraphers,
        db.TransactionCloseMode.Close
    )
}

process.on("unhandledRejection", (e) => {
    console.error(e)
    process.exit(1)
})

void main()
