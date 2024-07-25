import yaml from "yaml"
import fs from "fs-extra"
import path from "path"
import findProjectBaseDir from "../settings/findBaseDir.js"
import {
    IndicatorEntryAfterPreProcessing,
    IndicatorEntryBeforePreProcessing,
    MultiDimDataPageConfigPreProcessed,
    MultiDimDataPageConfigRaw,
    MultiIndicatorEntry,
} from "../site/multiDim/MultiDimDataPageTypes.js"
import { MultiDimDataPageConfig } from "../site/multiDim/MultiDimDataPageConfig.js"
import * as db from "../db/db.js"
import { renderToHtmlPage } from "./siteRenderers.js"
import { MultiDimDataPage } from "../site/multiDim/MultiDimDataPage.js"
import React from "react"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import { getTagToSlugMap } from "./GrapherBakingUtils.js"
import { getVariableIdsByCatalogPath } from "../db/model/Variable.js"

// TODO Make this dynamic
const baseDir = findProjectBaseDir(__dirname)
if (!baseDir) throw new Error("Could not find project base directory")
const MULTI_DIM_CONFIG_DIR = path.join(baseDir, "public/multi-dim")

const readMultiDimConfig = (filename: string) =>
    yaml.parse(
        fs.readFileSync(path.join(MULTI_DIM_CONFIG_DIR, filename), "utf8")
    )

const MULTI_DIM_SITES_BY_SLUG: Record<string, MultiDimDataPageConfigRaw> = {
    "mdd-causes-of-death": readMultiDimConfig("causes-of-death.yml"),
    "mdd-energy": readMultiDimConfig("energy.yml"),
    "mdd-life-expectancy": readMultiDimConfig("life-expectancy.json"),
    "mdd-plastic": readMultiDimConfig("plastic.json"),
    "mdd-poverty": readMultiDimConfig("poverty.yml"),
}

interface BakingAdditionalContext {
    tagToSlugMap: Record<string, string>
}

const resolveMultiDimDataPageCatalogPathsToIndicatorIds = async (
    knex: db.KnexReadonlyTransaction,
    rawConfig: MultiDimDataPageConfigRaw
): Promise<MultiDimDataPageConfigPreProcessed> => {
    const allCatalogPaths = rawConfig.views
        .flatMap((view) =>
            Object.values(view.indicators).flatMap((indicatorOrIndicators) =>
                Array.isArray(indicatorOrIndicators)
                    ? indicatorOrIndicators
                    : [indicatorOrIndicators]
            )
        )
        .filter((indicator) => typeof indicator === "string")

    const catalogPathToIndicatorIdMap = await getVariableIdsByCatalogPath(
        allCatalogPaths,
        knex
    )

    const missingCatalogPaths = new Set(
        allCatalogPaths.filter(
            (indicator) => !catalogPathToIndicatorIdMap.has(indicator)
        )
    )

    if (missingCatalogPaths.size > 0) {
        console.warn(
            `Could not find the following catalog paths in the database: ${Array.from(
                missingCatalogPaths
            ).join(", ")}`
        )
    }

    const resolveSingleField = (
        indicator: IndicatorEntryBeforePreProcessing
    ) => {
        if (typeof indicator === "string") {
            const indicatorId = catalogPathToIndicatorIdMap.get(indicator)
            return indicatorId ?? undefined
        } else {
            return indicator
        }
    }

    const resolveField = (
        indicator: MultiIndicatorEntry<IndicatorEntryBeforePreProcessing>
    ): MultiIndicatorEntry<IndicatorEntryAfterPreProcessing> => {
        if (Array.isArray(indicator)) {
            return indicator.map(resolveSingleField)
        } else {
            return resolveSingleField(indicator)
        }
    }

    for (const view of rawConfig.views) {
        view.indicators = Object.fromEntries(
            Object.entries(view.indicators).map(([key, value]) => [
                key,
                resolveField(value),
            ])
        ) as any
    }

    return rawConfig as MultiDimDataPageConfigPreProcessed
}

export const renderMultiDimDataPageBySlug = async (
    knex: db.KnexReadonlyTransaction,
    slug: string
) => {
    const rawConfig = MULTI_DIM_SITES_BY_SLUG[slug]
    if (!rawConfig) throw new Error(`No multi-dim site found for slug: ${slug}`)

    const tagToSlugMap = await getTagToSlugMap(knex)
    const bakingContext = { tagToSlugMap }

    const preProcessedConfig =
        await resolveMultiDimDataPageCatalogPathsToIndicatorIds(knex, rawConfig)
    const config = MultiDimDataPageConfig.fromObject(preProcessedConfig)
    return renderMultiDimDataPage(config, bakingContext)
}

export const renderMultiDimDataPage = async (
    config: MultiDimDataPageConfig,
    bakingContext?: BakingAdditionalContext
) => {
    return renderToHtmlPage(
        <MultiDimDataPage
            baseUrl={BAKED_BASE_URL}
            config={config}
            tagToSlugMap={bakingContext?.tagToSlugMap}
        />
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
