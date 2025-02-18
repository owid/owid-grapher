import {
    ArchivedChartVersionsTableName,
    ChartConfigsTableName,
    ChartsTableName,
    DbInsertArchivedChartVersion,
    DbPlainArchivedChartVersion,
    JsonString,
    parseChartConfig,
    VariablesTableName,
} from "@ourworldindata/types"
import * as db from "../db/db.js"
import { sortNumeric } from "@ourworldindata/utils"
import { mapValues, omit, partition, sortedUniq } from "lodash"
import { hashHex } from "../serverUtils/hash.js"
import { stringify } from "safe-stable-stringify"

const collectHashesForGrapherId = async (
    knex: db.KnexReadonlyTransaction,
    grapherId: number
) => {
    const row = await knex(ChartsTableName)
        .select("full", "fullMd5")
        .join(
            ChartConfigsTableName,
            `${ChartsTableName}.configId`,
            `${ChartConfigsTableName}.id`
        )
        .where({ [`${ChartsTableName}.id`]: grapherId })
        .first()

    const config = parseChartConfig(row.full)
    const varIds = sortNumeric(
        config.dimensions?.map((d) => d.variableId) ?? []
    )
    const uniqueVarIds = sortedUniq(varIds)

    const dataFileHashes = await knex(VariablesTableName)
        .select("id", "dataChecksum", "metadataChecksum")
        .whereIn("id", uniqueVarIds)
        .orderBy("id")

    if (dataFileHashes.length !== uniqueVarIds.length) {
        throw new Error(
            `A variable is missing from the database: ${uniqueVarIds}`
        )
    }

    return { configMd5: row.fullMd5, indicators: dataFileHashes }
}

export interface GrapherChecksums {
    chartConfigMd5: string
    indicators: {
        [id: string]: { metadataChecksum: string; dataChecksum: string }
    }
}

interface GrapherChecksumsObject {
    chartId: number
    checksums: GrapherChecksums
}

interface GrapherChecksumsObjectWithHash extends GrapherChecksumsObject {
    hashed: string
}

const getGrapherChecksumsFromDb = async (knex: db.KnexReadonlyTransaction) => {
    type FlatGrapherChecksums = {
        chartId: number
        chartConfigMd5: string
        indicators: JsonString
    }

    const rows: GrapherChecksumsObject[] = await db
        .knexRaw<FlatGrapherChecksums>(
            knex,
            // This query gets all published charts and their hashes, and all associated variables (keyed by variableId) and their checksums
            `-- sql
        SELECT 
            c.id AS chartId,
            cc.fullMd5 AS chartConfigMd5,
            JSON_OBJECTAGG(v.id, JSON_OBJECT("metadataChecksum", v.metadataChecksum, "dataChecksum", v.dataChecksum)) AS indicators
        FROM charts c
        JOIN chart_configs cc on c.configId = cc.id
        JOIN chart_dimensions cd on cd.chartId = c.id
        JOIN variables v on cd.variableId = v.id
        WHERE cc.full ->> "$.isPublished" = "true"
        GROUP BY c.id
        `
        )
        .then((row) =>
            row.map((r) => ({
                chartId: r.chartId,
                checksums: {
                    chartConfigMd5: r.chartConfigMd5,
                    indicators: JSON.parse(r.indicators),
                },
            }))
        )

    return rows
}

const getLatestArchivedVersionsFromDb = async (
    knex: db.KnexReadonlyTransaction
) => {
    return db.knexRaw(
        knex,
        `-- sql
        SELECT grapherId, archivalTimestamp, hashOfInputs
        FROM archived_chart_versions a1
        WHERE (grapherId, archivalTimestamp) IN (SELECT grapherId, MAX(archivalTimestamp) FROM archived_chart_versions a2 GROUP BY grapherId)
        GROUP BY id;
        `
    )
}

const hashChecksumsObj = (checksums: GrapherChecksums) => {
    const stringified = stringify(omit(checksums, "chartId"))
    const hashed = hashHex(stringified, null)
    return hashed
}

const findHashesInDb = async (
    knex: db.KnexReadonlyTransaction,
    hashes: string[]
) => {
    const rows: Pick<DbPlainArchivedChartVersion, "hashOfInputs">[] =
        await knex(ArchivedChartVersionsTableName)
            .select("hashOfInputs")
            .whereIn("hashOfInputs", hashes)
    return new Set(rows.map((r) => r.hashOfInputs))
}

const findChangedGrapherPages = async (knex: db.KnexReadonlyTransaction) => {
    const allChartChecksums = await getGrapherChecksumsFromDb(knex)

    const checksums: GrapherChecksumsObjectWithHash[] = allChartChecksums.map(
        (chartObj) => {
            const checksumsHashed = hashChecksumsObj(chartObj.checksums)
            return { ...chartObj, hashed: checksumsHashed }
        }
    )

    // We're gonna find the hashes of all the graphers that are already archived and up-to-date
    const hashesFoundInDb = await findHashesInDb(
        knex,
        checksums.map((c) => c.hashed)
    )
    const [alreadyArchived, needToBeArchived] = partition(checksums, (c) =>
        hashesFoundInDb.has(c.hashed)
    )

    console.log("total published graphers", checksums.length)
    console.log("already archived", alreadyArchived.length)
    console.log("need archived", needToBeArchived.length)

    return needToBeArchived
}

const insertEntriesInDb = async (
    knex: db.KnexReadWriteTransaction,
    rows: DbInsertArchivedChartVersion[]
) => {
    if (rows.length) knex(ArchivedChartVersionsTableName).insert(rows)
}

const main = async () => {
    await db.knexReadWriteTransaction(async (trx) => {
        const needToBeArchived = await findChangedGrapherPages(trx)
    })

    process.exit(0)
}

main().catch(console.error)
