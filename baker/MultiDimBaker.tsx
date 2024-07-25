import yaml from "yaml"
import fs from "fs-extra"
import path from "path"
import findProjectBaseDir from "../settings/findBaseDir.js"
import { MultiDimDataPageConfigType } from "../site/multiDim/MultiDimDataPageTypes.js"
import { MultiDimDataPageConfig } from "../site/multiDim/MultiDimDataPageConfig.js"
import * as db from "../db/db.js"
import { renderToHtmlPage } from "./siteRenderers.js"
import { MultiDimDataPage } from "../site/multiDim/MultiDimDataPage.js"
import React from "react"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"

// TODO Make this dynamic
const baseDir = findProjectBaseDir(__dirname)
if (!baseDir) throw new Error("Could not find project base directory")
const MULTI_DIM_CONFIG_DIR = path.join(baseDir, "public/multi-dim")

const readMultiDimConfig = (filename: string) =>
    yaml.parse(
        fs.readFileSync(path.join(MULTI_DIM_CONFIG_DIR, filename), "utf8")
    )

const MULTI_DIM_SITES_BY_SLUG: Record<string, MultiDimDataPageConfigType> = {
    "mdd-causes-of-death": readMultiDimConfig("causes-of-death.yml"),
    "mdd-energy": readMultiDimConfig("energy.yml"),
    "mdd-life-expectancy": readMultiDimConfig("life-expectancy.json"),
    "mdd-plastic": readMultiDimConfig("plastic.json"),
    "mdd-poverty": readMultiDimConfig("poverty.yml"),
}

export const renderMultiDimDataPageBySlug = async (
    knex: db.KnexReadonlyTransaction,
    slug: string
) => {
    const rawConfig = MULTI_DIM_SITES_BY_SLUG[slug]
    if (!rawConfig) throw new Error(`No multi-dim site found for slug: ${slug}`)

    const config = MultiDimDataPageConfig.fromObject(rawConfig)
    return renderToHtmlPage(
        <MultiDimDataPage baseUrl={BAKED_BASE_URL} config={config} />
    )
}

export const renderMultiDimDataPage = async (
    config: MultiDimDataPageConfig
) => {
    return renderToHtmlPage(
        <MultiDimDataPage baseUrl={BAKED_BASE_URL} config={config} />
    )
}

export const bakeMultiDimDataPage = async (
    knex: db.KnexReadonlyTransaction,
    bakedSiteDir: string,
    slug: string
) => {
    const renderedHtml = await renderMultiDimDataPageBySlug(knex, slug)
    const outPath = path.join(bakedSiteDir, `grapher/${slug}.html`)
    await fs.writeFile(outPath, renderedHtml)
}

export const bakeAllMultiDimDataPages = async (
    knex: db.KnexReadonlyTransaction,
    bakedSiteDir: string
) => {
    for (const slug of Object.keys(MULTI_DIM_SITES_BY_SLUG)) {
        await bakeMultiDimDataPage(knex, bakedSiteDir, slug)
    }
}
