import * as db from '../db'
import * as wpdb from '../articles/wpdb'
import * as _ from 'lodash'
import * as settings from '../settings'
import * as fs from 'fs-extra'
import * as glob from 'glob'
import * as path from 'path'

import { exec } from '../admin/serverUtil'
import { Chart } from '../model/Chart'
import { Tag } from '../model/Tag'
import { csvRow, slugify } from '../admin/serverUtil'


async function tagCharts() {
    await db.connect()

    const htmlDir = `/Users/mispy/wp-static`

    const paths = glob.sync(path.join(htmlDir, '*.html'))

    const slugToId = await Chart.mapSlugsToIds()
    const tags = await Tag.find({ isBulkImport: false })
    const tagsBySlug = _.keyBy(tags, t => slugify(t.name))

    const noTag = []
    const hasTag = []

    const exceptions = {
        "co2-and-other-greenhouse-gas-emissions": "co2-and-greenhouse-gas-emissions",
        "food-prices": "food-prices-and-expenditure",

    }

    for (const htmlPath of paths) {
        const text = await fs.readFile(htmlPath, "utf8")
        const pageSlug = (_.last(htmlPath.split("/")) as string).split('.')[0]
        const tag = tagsBySlug[pageSlug]

        const isEntry = text.match(/entry-sidebar/)

        if (isEntry && !tag) noTag.push(pageSlug)
        else hasTag.push(pageSlug)


        const grapherSlugs = (text.match(/(?<=\/grapher\/).+?(?=[?|"])/g)||[]).filter(slug => slug !== "embedCharts.js" && !slug.includes("admin/") && !slug.includes("public/view"))
        const chartIds = _.uniq(grapherSlugs.map(slug => slugToId[slug]))
    }

    console.log(noTag)




/*    const variables = await db.query("SELECT v.name, v.id FROM variables v JOIN chart_dimensions cd ON cd.variableId=v.id WHERE cd.chartId IN (?)", [chartIds])
    const variableIds = variables.map((v: any) => v.id)

    /*const slugs = (await fs.readFile("/Users/mispy/tmp/urls.txt", "utf8")).split("\n").filter(s => s.trim())
    const slugToId = await Chart.mapSlugsToIds()
    const idsToGet = slugs.map(slug => slugToId[slug])

    const variables = await db.query("SELECT v.name, v.id FROM variables v JOIN chart_dimensions cd ON cd.variableId=v.id WHERE cd.chartId IN (?)", [idsToGet])
    const variableIds = variables.map((v: any) => v.id)
    const stream = fs.createWriteStream("/Users/mispy/tmp/sdgs.csv")

    // From dataset CSV export
    const csvHeader = ["Entity", "Year"]
    for (const variable of variables) {
        csvHeader.push(variable.name)
    }

    const columnIndexByVariableId: {[key: number]: number} = {}
    for (const variable of variables) {
        columnIndexByVariableId[variable.id] = csvHeader.indexOf(variable.name)
    }

    stream.write(csvRow(csvHeader))

    const data = await db.query(`
        SELECT e.name AS entity, dv.year, dv.value, dv.variableId FROM data_values dv
        JOIN variables v ON v.id=dv.variableId
        JOIN entities e ON dv.entityId=e.id
        WHERE v.id IN (?)
        ORDER BY e.name ASC, dv.year ASC, dv.variableId ASC`, [variableIds])

    let row: string[] = []
    for (const datum of data) {
        if (datum.entity !== row[0] || datum.year !== row[1]) {
            // New row
            if (row.length) {
                stream.write(csvRow(row))
            }
            row = [datum.entity, datum.year]
            for (const variable of variables) {
                row.push("")
            }
        }

        row[columnIndexByVariableId[datum.variableId]] = datum.value
    }

    // Final row
    stream.write(csvRow(row))

    stream.end()

    await db.end()*/
}

tagCharts()
