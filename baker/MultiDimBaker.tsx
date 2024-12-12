import fs from "fs-extra"
import path from "path"
import {
    MultiDimDataPageConfigPreProcessed,
    MultiDimDataPageProps,
    FaqEntryKeyedByGdocIdAndFragmentId,
    MultiDimDataPageConfigEnriched,
} from "@ourworldindata/types"
import {
    MultiDimDataPageConfig,
    JsonError,
    keyBy,
    OwidVariableWithSource,
    pick,
} from "@ourworldindata/utils"
import * as db from "../db/db.js"
import { renderToHtmlPage } from "./siteRenderers.js"
import { MultiDimDataPage } from "../site/multiDim/MultiDimDataPage.js"
import React from "react"
import {
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../settings/serverSettings.js"
import { getTagToSlugMap } from "./GrapherBakingUtils.js"
import { getVariableMetadata } from "../db/model/Variable.js"
import pMap from "p-map"
import {
    fetchAndParseFaqs,
    getPrimaryTopic,
    resolveFaqsForVariable,
} from "./DatapageHelpers.js"
import { logErrorAndMaybeSendToBugsnag } from "../serverUtils/errorLog.js"
import {
    getAllMultiDimDataPages,
    getMultiDimDataPageBySlug,
} from "../db/model/MultiDimDataPage.js"

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
    knex: db.KnexReadonlyTransaction,
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

export const renderMultiDimDataPageFromConfig = async (
    knex: db.KnexReadonlyTransaction,
    slug: string,
    config: MultiDimDataPageConfigEnriched,
    isPreviewing: boolean = false
) => {
    // TAGS
    const tagToSlugMap = await getTagToSlugMap(knex)
    // Only embed the tags that are actually used by the datapage, instead of the complete JSON object with ~240 properties
    const minimalTagToSlugMap = pick(tagToSlugMap, config.topicTags ?? [])
    const pageConfig = MultiDimDataPageConfig.fromObject(config)

    // FAQs
    const variableMetaDict = await getRelevantVariableMetadata(config)
    const faqEntries = await getFaqEntries(knex, config, variableMetaDict)

    // PRIMARY TOPIC
    const primaryTopic = await getPrimaryTopic(knex, config.topicTags?.[0])

    const props = {
        baseUrl: BAKED_BASE_URL,
        baseGrapherUrl: BAKED_GRAPHER_URL,
        slug,
        configObj: pageConfig.config,
        tagToSlugMap: minimalTagToSlugMap,
        faqEntries,
        primaryTopic,
        isPreviewing,
    }

    return renderMultiDimDataPageFromProps(props)
}

export const renderMultiDimDataPageBySlug = async (
    knex: db.KnexReadonlyTransaction,
    slug: string,
    { onlyPublished = true }: { onlyPublished?: boolean } = {}
) => {
    const dbRow = await getMultiDimDataPageBySlug(knex, slug, { onlyPublished })
    if (!dbRow) throw new Error(`No multi-dim site found for slug: ${slug}`)

    return renderMultiDimDataPageFromConfig(knex, slug, dbRow.config)
}

export const renderMultiDimDataPageFromProps = async (
    props: MultiDimDataPageProps
) => {
    return renderToHtmlPage(<MultiDimDataPage {...props} />)
}

export const bakeMultiDimDataPage = async (
    knex: db.KnexReadonlyTransaction,
    bakedSiteDir: string,
    slug: string,
    config: MultiDimDataPageConfigEnriched
) => {
    const renderedHtml = await renderMultiDimDataPageFromConfig(
        knex,
        slug,
        config
    )
    const outPath = path.join(bakedSiteDir, `grapher/${slug}.html`)
    await fs.writeFile(outPath, renderedHtml)
}

export const bakeAllMultiDimDataPages = async (
    knex: db.KnexReadonlyTransaction,
    bakedSiteDir: string
) => {
    const multiDimsBySlug = await getAllMultiDimDataPages(knex)
    for (const [slug, row] of multiDimsBySlug.entries()) {
        await bakeMultiDimDataPage(knex, bakedSiteDir, slug, row.config)
    }
}
