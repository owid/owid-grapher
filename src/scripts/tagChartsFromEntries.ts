import * as db from '../db'
import * as wpdb from '../articles/wpdb'
import * as _ from 'lodash'
import * as settings from '../settings'
import * as fs from 'fs-extra'
import * as glob from 'glob'
import * as path from 'path'

import { slugify } from '../admin/serverUtil'
import { Chart } from '../model/Chart'
import { Tag } from '../model/Tag'


async function tagCharts() {
    await db.connect()

    const htmlDir = `/Users/mispy/wp-static`

    const paths = glob.sync(path.join(htmlDir, '*.html'))

    const slugToId = await Chart.mapSlugsToIds()
    const tags = await Tag.find({ isBulkImport: false })
    const tagsBySlug = _.keyBy(tags, t => slugify(t.name))

    const noTag = []
    const hasTag = []

    // Entries where the slug doesn't exactly match a corresponding tag
    const exceptions = {
        "co2-and-other-greenhouse-gas-emissions": "co2-and-greenhouse-gas-emissions",
        "employment-in-agriculture": "agricultural-employment",
        "extreme-poverty": "global-extreme-poverty",
        "fertilizer-and-pesticides": "fertilizers",
        "food-prices": "food-prices-expenditure",
        "land-cover": "land-use",
        "materialism-and-post-materialism": "materialism",
        "maternal-mortality": "maternal-health",
        "energy-production-and-changing-energy-sources": "energy-production-changing-energy-sources",
        "hunger-and-undernourishment": "hunger",
//        "micronutrient-deficiency": ""
        "obesity": "obesity-bmi",
//        "primary-and-secondary-education": ""
        "science-and-research": "science-research",
        "teachers-and-professors": "teachers-professors",
        "trade-and-globalization": "international-trade",
//        "water-use-sanitation": ""
        "world-population-growth": "population-growth",
        "yields-and-land-use-in-agriculture": "land-use-and-yields-in-agriculture"
    }

    for (const htmlPath of paths) {
        const text = await fs.readFile(htmlPath, "utf8")
        const pageSlug = (_.last(htmlPath.split("/")) as string).split('.')[0]
        const tag = tagsBySlug[pageSlug] || tagsBySlug[(exceptions as any)[pageSlug]]

        const isEntry = text.match(/entry-sidebar/)

        if (isEntry && !tag) noTag.push(pageSlug)
        else hasTag.push(pageSlug)

        const grapherSlugs = (text.match(/(?<=\/grapher\/).+?(?=[?|"])/g)||[]).filter(slug => slug !== "embedCharts.js" && !slug.includes("admin/") && !slug.includes("public/view"))
        const chartIds = _.uniq(grapherSlugs.map(slug => slugToId[slug]))
    }

    console.log(noTag)
    await db.end()
}

tagCharts()
