import * as db from "db/db"
import { renderToHtmlPage, JsonError } from "utils/server/serverUtil"
import React from "react"
import { CountriesIndexPage } from "./views/CountriesIndexPage"
import { GrapherScript } from "charts/core/GrapherScript"
import * as lodash from "lodash"
import {
    CountryProfileIndicator,
    CountryProfilePage
} from "./views/CountryProfilePage"
import { ChartDimension } from "charts/chart/ChartDimension"
import { Variable } from "db/model/Variable"
import { SiteBaker } from "./SiteBaker"
import { countries, getCountry } from "utils/countries"
import { OwidTable } from "owidTable/OwidTable"

export async function countriesIndexPage() {
    return renderToHtmlPage(<CountriesIndexPage countries={countries} />)
}

const cache = new Map()
// Cache the result of an operation by a key for the duration of the process
function bakeCache<T>(cacheKey: any, retriever: () => T): T {
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey)
    } else {
        const result = retriever()
        cache.set(cacheKey, result)
        return result
    }
}

// Find the charts that will be shown on the country profile page (if they have that country)
// TODO: make this page per variable instead
async function countryIndicatorCharts(): Promise<GrapherScript[]> {
    return bakeCache(countryIndicatorCharts, async () => {
        const charts = (
            await db
                .table("charts")
                .whereRaw("publishedAt is not null and is_indexable is true")
        ).map((c: any) => JSON.parse(c.config)) as GrapherScript[]
        return charts.filter(
            c =>
                c.hasChartTab &&
                c.type === "LineChart" &&
                c.dimensions.length === 1
        )
    })
}

async function countryIndicatorVariables(): Promise<Variable.Row[]> {
    return bakeCache(countryIndicatorVariables, async () => {
        const variableIds = (await countryIndicatorCharts()).map(
            c => c.dimensions[0].variableId
        )
        return Variable.rows(
            await db.table(Variable.table).whereIn("id", variableIds)
        )
    })
}

export async function denormalizeLatestCountryData(variableIds?: number[]) {
    const entities = (await db
        .table("entities")
        .select("id", "code")
        .whereRaw("validated is true and code is not null")) as {
        id: number
        code: string
    }[]

    const entitiesByCode = lodash.keyBy(entities, e => e.code)
    const entitiesById = lodash.keyBy(entities, e => e.id)
    const entityIds = countries.map(c => entitiesByCode[c.code].id)

    if (!variableIds) {
        variableIds = (await countryIndicatorVariables()).map(v => v.id)
    }

    const dataValuesQuery = db
        .table("data_values")
        .select("variableId", "entityId", "value", "year")
        .whereIn("variableId", variableIds)
        .whereRaw(`entityId in (?)`, [entityIds])
        .andWhere("year", ">", 2010)
        .andWhere("year", "<", 2020)
        .orderBy("year", "DESC")

    let dataValues = (await dataValuesQuery) as {
        variableId: number
        entityId: number
        value: string
        year: number
    }[]
    dataValues = lodash.uniqBy(
        dataValues,
        dv => `${dv.variableId}-${dv.entityId}`
    )
    const rows = dataValues.map(dv => ({
        variable_id: dv.variableId,
        country_code: entitiesById[dv.entityId].code,
        year: dv.year,
        value: dv.value
    }))

    db.knex().transaction(async t => {
        // Remove existing values
        await t
            .table("country_latest_data")
            .whereIn("variable_id", variableIds as number[])
            .delete()

        // Insert new ones
        await t.table("country_latest_data").insert(rows)
    })
}

async function countryIndicatorLatestData(countryCode: string) {
    const dataValuesByEntityId = await bakeCache(
        countryIndicatorLatestData,
        async () => {
            const dataValues = (await db
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

            return lodash.groupBy(dataValues, dv => dv.code)
        }
    )

    return dataValuesByEntityId[countryCode]
}

// async function countryIndicatorLatestData(countryCode: string) {
//     const dataValuesByEntityId = await bakeCache(countryIndicatorLatestData, async () => {
//         const entities = await db.table("entities").select("id", "code").whereRaw("validated is true and code is not null") as { id: number, code: string }[]

//         const entitiesByCode = _.keyBy(entities, e => e.code)
//         const entitiesById = _.keyBy(entities, e => e.id)
//         const entityIds = countries.map(c => entitiesByCode[c.code].id)

//         const variables = await countryIndicatorVariables()
//         const variableIds = variables.map(v => v.id)
//         // const dataValues = await db.table("entities")
//         //     .select("data_values.variableId", "data_values.entityId", "data_values.value", "data_values.year")
//         //     .join("data_values", "data_values.entityId", "=", "entities.id")
//         //     .whereIn("entities.code", countryCodes)
//         //     .orderBy("year", "DESC") as { variableId: number, entityId: number, value: string, year: number }[]

//         const dataValues = await db.table("data_values").select("variableId", "entityId", "value", "year")
//             .whereIn("variableId", variableIds)
//             .whereRaw(`entityId in (?)`, [entityIds])
//             .andWhere("year", ">", 2010)
//             .andWhere("year", "<", 2020)
//             .orderBy("year", "DESC") as { variableId: number, entityId: number, value: string, year: number }[]
//         return _.groupBy(dataValues, dv => entitiesById[dv.entityId].code)
//     })

//     return dataValuesByEntityId[countryCode]
// }

export async function countryProfilePage(countrySlug: string) {
    const country = getCountry(countrySlug)
    if (!country) {
        throw new JsonError(`No such country ${countrySlug}`, 404)
    }

    const charts = await countryIndicatorCharts()
    const variables = await countryIndicatorVariables()
    const variablesById = lodash.keyBy(variables, v => v.id)
    const dataValues = await countryIndicatorLatestData(country.code)

    const valuesByVariableId = lodash.groupBy(dataValues, v => v.variableId)

    let indicators: CountryProfileIndicator[] = []
    for (const c of charts) {
        const vid = c.dimensions[0] && c.dimensions[0].variableId
        const values = valuesByVariableId[vid]

        if (values && values.length) {
            const latestValue = values[0]
            const variable = variablesById[vid]

            // todo: this is a lot of setup to get formatValueShort. Maybe cleanup?
            const spec = new Map()
            spec.set(variable.name, {
                unit: variable.unit,
                display: variable.display
            })
            const column = new OwidTable([], spec)
            const dim = new ChartDimension(
                0,
                c.dimensions[0],
                column.columnsBySlug.get(variable.name)!
            )

            const formatValueShort = dim.formatValueShort

            let value: string | number
            value = parseFloat(latestValue.value)
            if (isNaN(value)) {
                value = latestValue.value
            } else if (variable.display.conversionFactor) {
                value *= variable.display.conversionFactor
            }

            indicators.push({
                year: latestValue.year,
                value: formatValueShort(value),
                name: c.title as string,
                slug: `/grapher/${c.slug}?tab=chart&country=${country.code}`,
                variantName: c.variantName
            })
        }
    }

    indicators = lodash.sortBy(indicators, i => i.name.trim())

    return renderToHtmlPage(
        <CountryProfilePage indicators={indicators} country={country} />
    )
}

export async function bakeCountries(baker: SiteBaker) {
    const html = await countriesIndexPage()
    await baker.writeFile("/countries.html", html)

    await baker.ensureDir("/country")
    for (const country of countries) {
        const path = `/country/${country.slug}.html`
        const html = await countryProfilePage(country.slug)
        await baker.writeFile(path, html)
    }
}
