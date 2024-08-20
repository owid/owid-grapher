import yaml from "yaml"
import fs from "fs-extra"
import path from "path"
import findProjectBaseDir from "../settings/findBaseDir.js"
import {
    IndicatorEntryBeforePreProcessing,
    IndicatorsAfterPreProcessing,
    MultiDimDataPageConfigPreProcessed,
    MultiDimDataPageConfigRaw,
    MultiDimDataPageProps,
    FaqEntryKeyedByGdocIdAndFragmentId,
} from "@ourworldindata/types"
import { MultiDimDataPageConfig } from "../site/multiDim/MultiDimDataPageConfig.js"
import * as db from "../db/db.js"
import { renderToHtmlPage } from "./siteRenderers.js"
import { MultiDimDataPage } from "../site/multiDim/MultiDimDataPage.js"
import React from "react"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import { getTagToSlugMap } from "./GrapherBakingUtils.js"
import {
    getVariableIdsByCatalogPath,
    getVariableMetadata,
} from "../db/model/Variable.js"
import pMap from "p-map"
import {
    JsonError,
    keyBy,
    mapValues,
    OwidVariableWithSource,
    pick,
} from "@ourworldindata/utils"
import {
    fetchAndParseFaqs,
    getPrimaryTopic,
    resolveFaqsForVariable,
} from "./DatapageHelpers.js"
import { logErrorAndMaybeSendToBugsnag } from "../serverUtils/errorLog.js"

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
    "mdd-mixed": readMultiDimConfig("mixed.yml"),
    "mdd-life-expectancy": readMultiDimConfig("life-expectancy.json"),
    "mdd-plastic": readMultiDimConfig("plastic.json"),
    "mdd-poverty": readMultiDimConfig("poverty.yml"),
}

const resolveMultiDimDataPageCatalogPathsToIndicatorIds = async (
    knex: db.KnexReadonlyTransaction,
    rawConfig: MultiDimDataPageConfigRaw
): Promise<MultiDimDataPageConfigPreProcessed> => {
    const allCatalogPaths = rawConfig.views
        .flatMap((view) =>
            Object.values(view.indicators ?? {}).flatMap(
                (indicatorOrIndicators) =>
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
            `Could not find the following catalog paths for MDD ${rawConfig.title} in the database: ${Array.from(
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
        indicator:
            | IndicatorEntryBeforePreProcessing
            | IndicatorEntryBeforePreProcessing[]
    ) => {
        if (Array.isArray(indicator)) {
            return indicator.map(resolveSingleField)
        } else {
            return resolveSingleField(indicator)
        }
    }

    for (const view of rawConfig.views) {
        if (view.indicators)
            view.indicators = mapValues(
                view.indicators,
                resolveField
            ) as IndicatorsAfterPreProcessing

        // Ensure that `indicators.y` exists and is a (possibly empty) array
        if (!view.indicators?.y) view.indicators = { ...view.indicators, y: [] }
        else if (!Array.isArray(view.indicators.y))
            view.indicators.y = [view.indicators.y]
    }

    return rawConfig as MultiDimDataPageConfigPreProcessed
}

const getRelevantVariableIds = (config: MultiDimDataPageConfigPreProcessed) => {
    // A "relevant" variable id is the first y indicator of each view
    const allIndicatorIds = config.views
        .map((view) => view.indicators.y?.[0])
        .filter((id) => id !== undefined)

    return new Set(allIndicatorIds)
}

const getRelevantVariableMetadata = async (
    config: MultiDimDataPageConfigPreProcessed
) => {
    const variableIds = getRelevantVariableIds(config)
    const metadata = await pMap(
        variableIds,
        async (id) => {
            return getVariableMetadata(id)
        },
        { concurrency: 10 }
    )

    return keyBy(metadata, (m) => m.id)
}

const getFaqEntries = async (
    knex: db.KnexReadWriteTransaction, // TODO: this transaction is only RW because somewhere inside it we fetch images
    config: MultiDimDataPageConfigPreProcessed,
    variableMetadataDict: Record<number, OwidVariableWithSource>
): Promise<FaqEntryKeyedByGdocIdAndFragmentId> => {
    const faqDocIds = new Set(
        Object.values(variableMetadataDict)
            .flatMap((metadata) =>
                metadata.presentation?.faqs?.map((faq) => faq.gdocId)
            )
            .filter((id) => id !== undefined)
    )

    const faqGdocs = await fetchAndParseFaqs(knex, Array.from(faqDocIds), {
        isPreviewing: false,
    })

    Object.values(variableMetadataDict).forEach((metadata) => {
        const { errors: faqResolveErrors } = resolveFaqsForVariable(
            faqGdocs,
            metadata
        )

        if (faqResolveErrors.length > 0) {
            for (const error of faqResolveErrors) {
                void logErrorAndMaybeSendToBugsnag(
                    new JsonError(
                        `MDD baking error for page "${config.title}" in finding FAQs for variable ${metadata.id}: ${error.error}`
                    )
                )
            }
        }
    })

    const faqContentsByGdocIdAndFragmentId = Object.values(
        variableMetadataDict
    ).reduce(
        (acc, metadata) => {
            metadata.presentation?.faqs?.forEach((faq) => {
                if (!faq.gdocId || !faq.fragmentId) return
                if (!acc[faq.gdocId]) acc[faq.gdocId] = {}
                if (!acc[faq.gdocId][faq.fragmentId]) {
                    const faqContent =
                        faqGdocs[faq.gdocId]?.[faq.fragmentId]?.content
                    if (faqContent) acc[faq.gdocId][faq.fragmentId] = faqContent
                }
            })
            return acc
        },
        {} as FaqEntryKeyedByGdocIdAndFragmentId["faqs"]
    )

    return {
        faqs: faqContentsByGdocIdAndFragmentId,
    }
}

export const renderMultiDimDataPageBySlug = async (
    knex: db.KnexReadWriteTransaction,
    slug: string
) => {
    const rawConfig = MULTI_DIM_SITES_BY_SLUG[slug]
    if (!rawConfig) throw new Error(`No multi-dim site found for slug: ${slug}`)

    // TAGS
    const tagToSlugMap = await getTagToSlugMap(knex)
    // Only embed the tags that are actually used by the datapage, instead of the complete JSON object with ~240 properties
    const minimalTagToSlugMap = pick(tagToSlugMap, rawConfig.topicTags ?? [])

    // PRE-PROCESS CONFIG
    const preProcessedConfig =
        await resolveMultiDimDataPageCatalogPathsToIndicatorIds(knex, rawConfig)
    const config = MultiDimDataPageConfig.fromObject(preProcessedConfig)

    // FAQs
    const variableMetaDict =
        await getRelevantVariableMetadata(preProcessedConfig)
    const faqEntries = await getFaqEntries(
        knex,
        preProcessedConfig,
        variableMetaDict
    )

    // PRIMARY TOPIC
    const primaryTopic = await getPrimaryTopic(
        knex,
        preProcessedConfig.topicTags?.[0]
    )

    const props = {
        configObj: config.config,
        tagToSlugMap: minimalTagToSlugMap,
        faqEntries,
        primaryTopic,
    }

    return renderMultiDimDataPage(props)
}

export const renderMultiDimDataPage = async (props: MultiDimDataPageProps) => {
    return renderToHtmlPage(
        <MultiDimDataPage baseUrl={BAKED_BASE_URL} multiDimProps={props} />
    )
}

export const bakeMultiDimDataPage = async (
    knex: db.KnexReadWriteTransaction,
    bakedSiteDir: string,
    slug: string
) => {
    const renderedHtml = await renderMultiDimDataPageBySlug(knex, slug)
    const outPath = path.join(bakedSiteDir, `grapher/${slug}.html`)
    await fs.writeFile(outPath, renderedHtml)
}

export const bakeAllMultiDimDataPages = async (
    knex: db.KnexReadWriteTransaction,
    bakedSiteDir: string
) => {
    for (const slug of Object.keys(MULTI_DIM_SITES_BY_SLUG)) {
        await bakeMultiDimDataPage(knex, bakedSiteDir, slug)
    }
}
