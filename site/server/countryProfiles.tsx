import { ChartConfigProps } from "charts/ChartConfig"
import { DimensionWithData } from "charts/DimensionWithData"
import db = require("db/db")
import { Variable } from "db/model/Variable"
import fs = require("fs-extra")
import _ = require("lodash")
import React = require("react")
import { countries } from "utils/countries"
import { JsonError, renderToHtmlPage } from "utils/server/serverUtil"

import { SiteBaker } from "./SiteBaker"
import { CountriesIndexPage } from "./views/CountriesIndexPage"
import {
    CountryProfileIndicator,
    CountryProfilePage
} from "./views/CountryProfilePage"

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
async function countryIndicatorCharts(): Promise<ChartConfigProps[]> {
    return bakeCache(countryIndicatorCharts, async () => {
        const charts = (
            await db
                .table("charts")
                .whereRaw("publishedAt is not null and is_indexable is true")
        ).map((c: any) => JSON.parse(c.config)) as ChartConfigProps[]
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

    const entitiesByCode = _.keyBy(entities, e => e.code)
    const entitiesById = _.keyBy(entities, e => e.id)
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
    dataValues = _.uniqBy(dataValues, dv => `${dv.variableId}-${dv.entityId}`)
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

            return _.groupBy(dataValues, dv => dv.code)
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
    const country = countries.find(c => c.slug === countrySlug)
    if (!country) {
        throw new JsonError(`No such country ${countrySlug}`, 404)
    }

    const charts = await countryIndicatorCharts()
    const variables = await countryIndicatorVariables()
    const variablesById = _.keyBy(variables, v => v.id)
    const dataValues = await countryIndicatorLatestData(country.code)

    const valuesByVariableId = _.groupBy(dataValues, v => v.variableId)

    let indicators: CountryProfileIndicator[] = []
    for (const c of charts) {
        const vid = c.dimensions[0] && c.dimensions[0].variableId
        const values = valuesByVariableId[vid]

        if (values && values.length) {
            const latestValue = values[0]
            const variable = variablesById[vid]

            const dim = new DimensionWithData(
                0,
                c.dimensions[0],
                variable as any
            )

            let value: string | number
            value = parseFloat(latestValue.value)
            if (isNaN(value)) {
                value = latestValue.value
            } else if (variable.display.conversionFactor) {
                value *= variable.display.conversionFactor
            }

            indicators.push({
                year: latestValue.year,
                value: dim.formatValueShort(value),
                name: c.title as string,
                slug: `/grapher/${c.slug}?tab=chart&country=${country.code}`,
                variantName: c.variantName
            })
        }
    }

    indicators = _.sortBy(indicators, i => i.name.trim())

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
