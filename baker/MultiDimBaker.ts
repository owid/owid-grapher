import yaml from "yaml"
import fs from "fs-extra"
import path from "path"
import findProjectBaseDir from "../settings/findBaseDir.js"
import { MultiDimDataPageConfigType } from "../site/multiDim/MultiDimDataPageTypes.js"
import { MultiDimDataPageConfig } from "../site/multiDim/MultiDimDataPageConfig.js"
import { renderMultiDimDataPage } from "./siteRenderers.js"
import * as db from "../db/db.js"

// TODO Make this dynamic
const baseDir = findProjectBaseDir(__dirname)
if (!baseDir) throw new Error("Could not find project base directory")
const MULTI_DIM_CONFIG_DIR = path.join(baseDir, "public/multi-dim")

const readMultiDimConfig = (filename: string) =>
    yaml.parse(
        fs.readFileSync(path.join(MULTI_DIM_CONFIG_DIR, filename), "utf8")
    )

const MULTI_DIM_SITES_BY_SLUG: Record<string, MultiDimDataPageConfigType> = {
    "mdd-energy": readMultiDimConfig("energy.yml"),
    "mdd-life-expectancy": readMultiDimConfig("life-expectancy.json"),
    "mdd-plastic": readMultiDimConfig("plastic.json"),
    "mdd-poverty": readMultiDimConfig("poverty.yml"),
}

export const bakeMultiDimDataPage = async (
    bakedSiteDir: string,
    slug: string
) => {
    const site = MULTI_DIM_SITES_BY_SLUG[slug]
    if (!site) throw new Error(`No multi-dim site found for slug: ${slug}`)

    const config = MultiDimDataPageConfig.fromObject(site)

    const outPath = path.join(bakedSiteDir, `grapher/${slug}.html`)
    const renderedHtml = await renderMultiDimDataPage(config)
    await fs.writeFile(outPath, renderedHtml)
}

export const bakeAllMultiDimDataPages = async (
    bakedSiteDir: string,
    knex: db.KnexReadonlyTransaction
) => {
    for (const slug of Object.keys(MULTI_DIM_SITES_BY_SLUG)) {
        await bakeMultiDimDataPage(bakedSiteDir, slug)
    }
}
