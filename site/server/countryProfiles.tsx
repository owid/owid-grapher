import db = require('db/db')
import { slugify, renderToHtmlPage } from 'utils/server/serverUtil';
import React = require('react');
import { CountriesIndexPage } from './views/CountriesIndexPage';
import { ChartConfigProps } from 'charts/ChartConfig';
import _ = require('lodash');
import { CountryProfileIndicator, CountryProfilePage } from './views/CountryProfilePage';
import { DimensionWithData } from 'charts/DimensionWithData';
import { Variable } from 'db/model/Variable';
import fs = require('fs-extra')
import { BAKED_SITE_DIR } from 'serverSettings';
import { SiteBaker } from './SiteBaker';

export async function countriesIndexPage() {
    const countries = (await db.table('entities').whereRaw("validated is true and code is not null")).filter((c: any) => c.code.length === 3)
    for (const country of countries) {
        country.slug = slugify(country.name)
    }
    return renderToHtmlPage(<CountriesIndexPage countries={countries}/>)
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
        const charts = (await db.table("charts")).map((c: any) => JSON.parse(c.config)) as ChartConfigProps[]    
        return charts.filter(c => c.hasChartTab && c.type === "LineChart" && c.dimensions.length === 1)    
    })
}

async function countryIndicatorVariables(): Promise<Variable.Row[]> {
    return bakeCache(countryIndicatorVariables, async () => {
        const variableIds = (await countryIndicatorCharts()).map(c => c.dimensions[0].variableId)
        return Variable.rows(await db.table(Variable.table).whereIn("id", variableIds))    
    })
}

async function countryIndicatorLatestData(entityId: number) {
    const dataValuesByEntityId = await bakeCache(countryIndicatorLatestData, async () => {
        const variables = await countryIndicatorVariables()
        const variableIds = variables.map(v => v.id)
        const dataValues = await db.table("data_values").select("variableId", "entityId", "value", "year")
            .whereIn("variableId", variableIds)
            .orderBy("year", "DESC") as { variableId: number, entityId: number, value: string, year: number }[]    
        return _.groupBy(dataValues, dv => dv.entityId)
    })

    return dataValuesByEntityId[entityId]
}

export async function countryProfilePage(countryName: string) {
    const country = await db.table('entities').whereRaw('lower(name) = ?', [countryName.toLowerCase()]).first()
    country.slug = slugify(country.name)

    const charts = await countryIndicatorCharts()
    const variables = await countryIndicatorVariables()
    const variablesById = _.keyBy(variables, v => v.id)
    const dataValues = await countryIndicatorLatestData(country.id)

    const valuesByVariableId = _.groupBy(dataValues, v => v.variableId)

    let indicators: CountryProfileIndicator[] = []
    for (const c of charts) {
        const vid = c.dimensions[0] && c.dimensions[0].variableId
        const values = valuesByVariableId[vid]

        if (values && values.length) {
            const latestValue = values[0]
            const variable = variablesById[vid]

            const dim = new DimensionWithData(0, c.dimensions[0], variable as any)

            const floatValue = parseFloat(latestValue.value)
            const value = isNaN(floatValue) ? latestValue.value : floatValue

            indicators.push({
                year: latestValue.year,
                value: dim.formatValueShort(value),
                name: c.title as string,
                slug: `/grapher/${c.slug}?tab=chart&country=${country.code}`
            })
        }
    }
 
    indicators = _.sortBy(indicators, i => i.name.trim())

    return renderToHtmlPage(<CountryProfilePage indicators={indicators} country={country}/>)
}

export async function bakeCountries(baker: SiteBaker) {
    const countries = await db.table('entities').where({ validated: true })

    await baker.ensureDir('/country')
    for (const country of countries) {
        const slug = slugify(country.name)
        const path = `/country/${slug}.html`
        const html = await countryProfilePage(country.name)
        await baker.writeFile(path, html)
    }
}