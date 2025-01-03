import * as db from "../db/db.js"
import { CountriesIndexPage } from "../site/CountriesIndexPage.js"
import {
    GrapherInterface,
    DbRawVariable,
    DbEnrichedVariable,
    VariablesTableName,
    parseVariablesRow,
    DbRawChartConfig,
    parseChartConfig,
} from "@ourworldindata/types"
import * as lodash from "lodash"
import {
    CountryProfileIndicator,
    CountryProfilePage,
} from "../site/CountryProfilePage.js"
import { SiteBaker } from "./SiteBaker.js"
import { countries, getCountryBySlug, JsonError } from "@ourworldindata/utils"
import { renderToHtmlPage } from "./siteRenderers.js"
import { dataAsDF } from "../db/model/Variable.js"
import pl from "nodejs-polars"

export const countriesIndexPage = (baseUrl: string) =>
    renderToHtmlPage(
        <CountriesIndexPage countries={countries} baseUrl={baseUrl} />
    )

const cache = new Map()
// Cache the result of an operation by a key for the duration of the process
function bakeCache<T>(cacheKey: any, retriever: () => T): T {
    if (cache.has(cacheKey)) return cache.get(cacheKey)

    const result = retriever()
    cache.set(cacheKey, result)
    return result
}

const hasChartTab = (grapher: GrapherInterface): boolean =>
    !grapher.chartTypes || grapher.chartTypes.length > 0

const checkShouldShowIndicator = (grapher: GrapherInterface) =>
    hasChartTab(grapher) &&
    (grapher.chartTypes?.[0] ?? "LineChart") === "LineChart" &&
    grapher.dimensions?.length === 1

// Find the charts that will be shown on the country profile page (if they have that country)
// TODO: make this page per variable instead
const countryIndicatorGraphers = async (
    trx: db.KnexReadonlyTransaction
): Promise<GrapherInterface[]> =>
    bakeCache(countryIndicatorGraphers, async () => {
        const configs = await db.knexRaw<{ config: DbRawChartConfig["full"] }>(
            trx,
            `-- sql
                SELECT cc.full as config
                FROM charts c
                JOIN chart_configs cc ON cc.id = c.configId
                WHERE
                    c.publishedAt is not null
                    AND cc.full->>'$.isPublished' = 'true'
                    AND c.isIndexable is true
            `
        )

        const graphers = configs.map((c: any) => parseChartConfig(c.config))

        return graphers.filter(checkShouldShowIndicator)
    })

export const countryIndicatorVariables = async (
    trx: db.KnexReadonlyTransaction
): Promise<DbEnrichedVariable[]> =>
    bakeCache(countryIndicatorVariables, async () => {
        const variableIds = (await countryIndicatorGraphers(trx)).map(
            (c) => c.dimensions![0]!.variableId
        )
        const rows: DbRawVariable[] = await trx
            .table(VariablesTableName)
            .whereIn("id", variableIds)
        return rows.map(parseVariablesRow)
    })

export const denormalizeLatestCountryData = async (
    trx: db.KnexReadWriteTransaction,
    variableIds?: number[]
) => {
    const entities = (await trx
        .table("entities")
        .select("id", "code")
        .whereRaw("validated is true and code is not null")) as {
        id: number
        code: string
    }[]

    const entitiesByCode = lodash.keyBy(entities, (e) => e.code)
    const entityIds = countries.map((c) => entitiesByCode[c.code].id)

    if (!variableIds) {
        variableIds = (await countryIndicatorVariables(trx)).map((v) => v.id)

        // exclude variables that are already in country_latest_data
        // NOTE: we always fetch all variables that don't have country entities because they never
        // get saved to `country_latest_data`. This is wasteful, but until we have metadata about
        // entities used in variables there's no easy way. It's not as bad since this still takes
        // under a minute to run.
        const existingVariableIds = (
            await db.knexRaw<{ variable_id: number }>(
                trx,
                `-- sql
                SELECT
                    variable_id
                FROM
                    country_latest_data
                WHERE
                    variable_id IN (?)`,
                [variableIds]
            )
        ).map((r) => r.variable_id)
        variableIds = lodash.difference(variableIds, existingVariableIds)
    }

    const currentYear = new Date().getUTCFullYear()

    const df = (await dataAsDF(variableIds, trx))
        .filter(
            pl
                .col("entityId")
                .isIn(entityIds)
                .and(pl.col("year").ltEq(currentYear))
                .and(pl.col("year").gt(currentYear - 10)) // latest data point should be at most 10 years old
        )
        // keep only the latest data point for each variable and entity
        .sort("year", true)
        .unique(true, ["variableId", "entityId"], "first")
        // only keep relevant columns
        .select("variableId", "entityCode", "year", "value")
        .rename({ variableId: "variable_id", entityCode: "country_code" })

    // Remove existing values
    await trx
        .table("country_latest_data")
        .whereIn("variable_id", variableIds as number[])
        .delete()

    // Insert new ones
    if (df.height > 0) {
        await trx.table("country_latest_data").insert(df.toRecords())
    }
}

const countryIndicatorLatestData = async (
    trx: db.KnexReadonlyTransaction,
    countryCode: string
) => {
    const dataValuesByEntityId = await bakeCache(
        countryIndicatorLatestData,
        async () => {
            const dataValues = (await trx
                .table("country_latest_data")
                .select(
                    "variable_id AS variableId",
                    "country_code AS code",
                    "year",
                    "value"
                )) as {
                variableId: number
                code: string
                year: number
                value: string
            }[]

            return lodash.groupBy(dataValues, (dv) => dv.code)
        }
    )

    return dataValuesByEntityId[countryCode]
}

export const countryProfilePage = async (
    trx: db.KnexReadonlyTransaction,
    countrySlug: string,
    baseUrl: string
) => {
    const country = getCountryBySlug(countrySlug)
    if (!country) throw new JsonError(`No such country ${countrySlug}`, 404)

    const graphers = await countryIndicatorGraphers(trx)
    const dataValues = await countryIndicatorLatestData(trx, country.code)

    const valuesByVariableId = lodash.groupBy(dataValues, (v) => v.variableId)

    let indicators: CountryProfileIndicator[] = []
    for (const grapher of graphers) {
        const firstDimension = grapher.dimensions![0]
        const vid = firstDimension && firstDimension.variableId
        const values = valuesByVariableId[vid]

        if (values && values.length) {
            const latestValue = values[0]

            indicators.push({
                year: latestValue.year,
                name: grapher.title as string,
                slug: `/grapher/${grapher.slug}?tab=chart&country=${country.code}`,
                variantName: grapher.variantName,
            })
        }
    }

    indicators = lodash.sortBy(indicators, (i) => i.name.trim())

    return renderToHtmlPage(
        <CountryProfilePage
            indicators={indicators}
            country={country}
            baseUrl={baseUrl}
        />
    )
}

export const bakeCountries = async (
    baker: SiteBaker,
    trx: db.KnexReadonlyTransaction
) => {
    const html = await countriesIndexPage(baker.baseUrl)
    await baker.writeFile("/countries.html", html)

    await baker.ensureDir("/country")
    for (const country of countries) {
        const path = `/country/${country.slug}.html`
        const html = await countryProfilePage(trx, country.slug, baker.baseUrl)
        await baker.writeFile(path, html)
    }

    baker.progressBar.tick({ name: "✅ baked countries" })
}
