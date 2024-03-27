import { Grapher } from "@ourworldindata/grapher"
import { GrapherInterface, GrapherTabOption } from "@ourworldindata/types"
import * as db from "../db/db.js"
import pMap from "p-map"

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

const obtainEntityNameToIdMap = async (trx: db.KnexReadonlyTransaction) => {
    const entityNameToIdMap = new Map<string, number>()
    const entities = await trx("entities").select("id", "name").stream()
    for await (const entity of entities)
        entityNameToIdMap.set(entity.name, entity.id)

    return entityNameToIdMap
}

const obtainAvailableEntitiesForAllGraphers = async (
    trx: db.KnexReadonlyTransaction
) => {
    const entityNameToIdMap = await obtainEntityNameToIdMap(trx)

    const allPublishedGraphers = await trx
        .select("id", "config")
        .from("charts")
        .whereRaw("config ->> '$.isPublished' = 'true'")

    const availableEntitiesByChartId = new Map<number, number[]>()
    await pMap(
        allPublishedGraphers,
        async (grapher) => {
            const config = JSON.parse(grapher.config) as GrapherInterface
            const availableEntities =
                await obtainAvailableEntitiesForGrapherConfig(config)
            const availableEntityIds = availableEntities.flatMap(
                (entityName) => {
                    const entityId = entityNameToIdMap.get(entityName)
                    if (entityId === undefined) {
                        console.error(
                            `Entity not found for chart ${grapher.id}: "${entityName}"`
                        )
                        return []
                    }
                    return [entityId]
                }
            )
            availableEntitiesByChartId.set(grapher.id, availableEntityIds)

            console.log(grapher.id, config.slug)
        },
        { concurrency: 10 }
    )

    return availableEntitiesByChartId
}

const updateAvailableEntitiesForAllGraphers = async (
    trx: db.KnexReadWriteTransaction
) => {
    console.log(
        "--- Obtaining available entity ids for all published graphers ---"
    )
    const availableEntitiesByChartId =
        await obtainAvailableEntitiesForAllGraphers(trx)

    console.log("--- Updating charts_x_entities ---")

    await trx.delete().from("charts_x_entities") // clears out the WHOLE table
    for (const [chartId, availableEntityIds] of availableEntitiesByChartId) {
        const rows = availableEntityIds.map((entityId) => ({
            chartId,
            entityId,
        }))
        if (rows.length) await trx("charts_x_entities").insert(rows)
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
