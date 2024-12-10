import React from "react"
import { GrapherPage } from "../site/GrapherPage.js"
import { DataPageV2 } from "../site/DataPageV2.js"
import { renderToHtmlPage } from "../baker/siteRenderers.js"
import {
    excludeUndefined,
    urlToSlug,
    without,
    deserializeJSONFromHTML,
    uniq,
    keyBy,
    compact,
    mergeGrapherConfigs,
} from "@ourworldindata/utils"
import fs from "fs-extra"
import * as lodash from "lodash"
import { bakeGrapherToSvgAndPng } from "./GrapherImageBaker.js"
import {
    OPTIMIZE_SVG_EXPORTS,
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../settings/serverSettings.js"
import * as db from "../db/db.js"
import { glob } from "glob"
import { isPathRedirectedToExplorer } from "../explorerAdminServer/ExplorerRedirects.js"
import {
    getPostIdFromSlug,
    getPostRelatedCharts,
    getRelatedArticles,
    getRelatedResearchAndWritingForVariable,
} from "../db/model/Post.js"
import {
    JsonError,
    GrapherInterface,
    OwidVariableDataMetadataDimensions,
    DimensionProperty,
    OwidVariableWithSource,
    OwidChartDimensionInterface,
    FaqEntryData,
    ImageMetadata,
    DbPlainChart,
    DbRawChartConfig,
    DbEnrichedImage,
} from "@ourworldindata/types"
import ProgressBar from "progress"
import {
    getVariableData,
    getMergedGrapherConfigForVariable,
    getVariableOfDatapageIfApplicable,
} from "../db/model/Variable.js"
import {
    fetchAndParseFaqs,
    getDatapageDataV2,
    getPrimaryTopic,
    resolveFaqsForVariable,
} from "./DatapageHelpers.js"
import { getAllImages } from "../db/model/Image.js"
import { logErrorAndMaybeSendToBugsnag } from "../serverUtils/errorLog.js"

import { getTagToSlugMap } from "./GrapherBakingUtils.js"
import { knexRaw } from "../db/db.js"
import { getRelatedChartsForVariable } from "../db/model/Chart.js"
import pMap from "p-map"

const renderDatapageIfApplicable = async (
    grapher: GrapherInterface,
    isPreviewing: boolean,
    knex: db.KnexReadonlyTransaction,
    imageMetadataDictionary?: Record<string, DbEnrichedImage>
) => {
    const variable = await getVariableOfDatapageIfApplicable(grapher)

    if (!variable) return undefined

    // When baking from `bakeSingleGrapherChart`, we cache imageMetadata to avoid fetching every image for every chart
    // But when rendering a datapage from the mockSiteRouter we want to be able to fetch imageMetadata on the fly
    // And this function is the point in the two paths where it makes sense to do so
    if (!imageMetadataDictionary) {
        imageMetadataDictionary = await getAllImages(knex).then((images) =>
            keyBy(images, "filename")
        )
    }

    return await renderDataPageV2(
        {
            variableId: variable.id,
            variableMetadata: variable.metadata,
            isPreviewing: isPreviewing,
            useIndicatorGrapherConfigs: false,
            pageGrapher: grapher,
            imageMetadataDictionary,
        },
        knex
    )
}

/**
 *
 * Render a datapage if available, otherwise render a grapher page.
 */

export const renderDataPageOrGrapherPage = async (
    grapher: GrapherInterface,
    knex: db.KnexReadonlyTransaction,
    imageMetadataDictionary?: Record<string, DbEnrichedImage>
): Promise<string> => {
    const datapage = await renderDatapageIfApplicable(
        grapher,
        false,
        knex,
        imageMetadataDictionary
    )
    if (datapage) return datapage
    return renderGrapherPage(grapher, knex)
}

export async function renderDataPageV2(
    {
        variableId,
        variableMetadata,
        isPreviewing,
        useIndicatorGrapherConfigs,
        pageGrapher,
        imageMetadataDictionary = {},
    }: {
        variableId: number
        variableMetadata: OwidVariableWithSource
        isPreviewing: boolean
        useIndicatorGrapherConfigs: boolean
        pageGrapher?: GrapherInterface
        imageMetadataDictionary?: Record<string, ImageMetadata>
    },
    knex: db.KnexReadonlyTransaction
) {
    const grapherConfigForVariable = await getMergedGrapherConfigForVariable(
        knex,
        variableId
    )
    // Only merge the grapher config on the indicator if the caller tells us to do so -
    // this is true for preview pages for datapages on the indicator level but false
    // if we are on Grapher pages. Once we have a good way in the grapher admin for how
    // to use indicator level defaults, we should reconsider how this works here.
    const grapher = useIndicatorGrapherConfigs
        ? mergeGrapherConfigs(grapherConfigForVariable ?? {}, pageGrapher ?? {})
        : (pageGrapher ?? {})

    const faqDocIds = compact(
        uniq(variableMetadata.presentation?.faqs?.map((faq) => faq.gdocId))
    )

    const faqGdocs = await fetchAndParseFaqs(knex, faqDocIds, { isPreviewing })

    const { resolvedFaqs, errors: faqResolveErrors } = resolveFaqsForVariable(
        faqGdocs,
        variableMetadata
    )

    if (faqResolveErrors.length > 0) {
        for (const error of faqResolveErrors) {
            await logErrorAndMaybeSendToBugsnag(
                new JsonError(
                    `Data page error in finding FAQs for variable ${variableId}: ${error.error}`
                )
            )
        }
    }

    const faqEntries: FaqEntryData = {
        faqs: resolvedFaqs?.flatMap((faq) => faq.enrichedFaq.content) ?? [],
    }

    // If we are rendering this in the context of an indicator page preview or similar,
    // then the chart config might be entirely empty. Make sure that dimensions is
    // set to the variableId as a Y variable in theses cases.
    if (
        !grapher.dimensions ||
        (grapher.dimensions as OwidChartDimensionInterface[]).length === 0
    ) {
        const dimensions: OwidChartDimensionInterface[] = [
            {
                variableId: variableId,
                property: DimensionProperty.y,
                display: variableMetadata.display,
            },
        ]
        grapher.dimensions = dimensions
    }
    const datapageData = await getDatapageDataV2(
        variableMetadata,
        grapher ?? {}
    )

    const firstTopicTag = datapageData.topicTagsLinks?.[0]
    datapageData.primaryTopic = await getPrimaryTopic(knex, firstTopicTag)

    // Get the charts this variable is being used in (aka "related charts")
    // and exclude the current chart to avoid duplicates
    datapageData.allCharts = await getRelatedChartsForVariable(
        knex,
        variableId,
        grapher && "id" in grapher ? [grapher.id as number] : []
    )

    datapageData.relatedResearch =
        await getRelatedResearchAndWritingForVariable(knex, variableId)

    const relatedResearchFilenames = datapageData.relatedResearch
        .map((r) => r.imageUrl)
        .filter((f): f is string => !!f)

    const imageMetadata = lodash.pick(
        imageMetadataDictionary,
        uniq(relatedResearchFilenames)
    )

    const tagToSlugMap = await getTagToSlugMap(knex)

    return renderToHtmlPage(
        <DataPageV2
            grapher={grapher}
            datapageData={datapageData}
            baseUrl={BAKED_BASE_URL}
            baseGrapherUrl={BAKED_GRAPHER_URL}
            isPreviewing={isPreviewing}
            imageMetadata={imageMetadata}
            faqEntries={faqEntries}
            tagToSlugMap={tagToSlugMap}
        />
    )
}

/**
 *
 * Similar to renderDataPageOrGrapherPage(), but for admin previews
 */
export const renderPreviewDataPageOrGrapherPage = async (
    grapher: GrapherInterface,
    knex: db.KnexReadonlyTransaction
) => {
    const datapage = await renderDatapageIfApplicable(grapher, true, knex)
    if (datapage) return datapage

    return renderGrapherPage(grapher, knex)
}

const renderGrapherPage = async (
    grapher: GrapherInterface,
    knex: db.KnexReadonlyTransaction
) => {
    const postSlug = urlToSlug(grapher.originUrl || "") as string | undefined
    // TODO: update this to use gdocs posts
    const postId = postSlug
        ? await getPostIdFromSlug(knex, postSlug)
        : undefined
    const relatedCharts = postId
        ? await getPostRelatedCharts(knex, postId)
        : undefined
    const relatedArticles = grapher.id
        ? await getRelatedArticles(knex, grapher.id)
        : undefined

    return renderToHtmlPage(
        <GrapherPage
            grapher={grapher}
            relatedCharts={relatedCharts}
            relatedArticles={relatedArticles}
            baseUrl={BAKED_BASE_URL}
            baseGrapherUrl={BAKED_GRAPHER_URL}
        />
    )
}

const chartIsSameVersion = async (
    htmlPath: string,
    grapherVersion: number | undefined
): Promise<boolean> => {
    if (fs.existsSync(htmlPath)) {
        // If the chart is the same version, we can potentially skip baking the data and exports (which is by far the slowest part)
        const html = await fs.readFile(htmlPath, "utf8")
        const savedVersion = deserializeJSONFromHTML(html)
        return savedVersion?.version === grapherVersion
    } else {
        return false
    }
}

const bakeGrapherPageAndVariablesPngAndSVGIfChanged = async (
    bakedSiteDir: string,
    imageMetadataDictionary: Record<string, DbEnrichedImage>,
    grapher: GrapherInterface,
    knex: db.KnexReadonlyTransaction
) => {
    const htmlPath = `${bakedSiteDir}/grapher/${grapher.slug}.html`
    const isSameVersion = await chartIsSameVersion(htmlPath, grapher.version)

    // Need to set up the connection for using TypeORM in
    // renderDataPageOrGrapherPage() when baking using multiple worker threads
    // (MAX_NUM_BAKE_PROCESSES > 1). It could be done in
    // renderDataPageOrGrapherPage() too, but given that this render function is also used
    // for rendering a datapage preview in the admin where worker threads are
    // not used, lifting the connection set up here seems more appropriate.

    // Always bake the html for every chart; it's cheap to do so
    const outPath = `${bakedSiteDir}/grapher/${grapher.slug}.html`
    await fs.writeFile(
        outPath,
        await renderDataPageOrGrapherPage(
            grapher,
            knex,
            imageMetadataDictionary
        )
    )
    console.log(outPath)

    const variableIds = lodash.uniq(
        grapher.dimensions?.map((d) => d.variableId)
    )
    if (!variableIds.length) return

    await fs.mkdirp(`${bakedSiteDir}/grapher/exports/`)
    const svgPath = `${bakedSiteDir}/grapher/exports/${grapher.slug}.svg`
    const pngPath = `${bakedSiteDir}/grapher/exports/${grapher.slug}.png`
    if (!isSameVersion || !fs.existsSync(svgPath) || !fs.existsSync(pngPath)) {
        const loadDataMetadataPromises: Promise<OwidVariableDataMetadataDimensions>[] =
            variableIds.map(getVariableData)
        const variableDataMetadata = await Promise.all(loadDataMetadataPromises)
        const variableDataMedadataMap = new Map(
            variableDataMetadata.map((item) => [item.metadata.id, item])
        )
        await bakeGrapherToSvgAndPng(
            `${bakedSiteDir}/grapher/exports`,
            grapher,
            variableDataMedadataMap,
            OPTIMIZE_SVG_EXPORTS
        )
    }
}

const deleteOldGraphers = async (bakedSiteDir: string, newSlugs: string[]) => {
    // Delete any that are missing from the database
    const oldSlugs = glob
        .sync(`${bakedSiteDir}/grapher/*.html`)
        .map((slug) =>
            slug.replace(`${bakedSiteDir}/grapher/`, "").replace(".html", "")
        )
    const toRemove = without(oldSlugs, ...newSlugs)
        // do not delete grapher slugs redirected to explorers
        .filter((slug) => !isPathRedirectedToExplorer(`/grapher/${slug}`))
    for (const slug of toRemove) {
        console.log(`DELETING ${slug}`)
        try {
            const paths = [
                `${bakedSiteDir}/grapher/${slug}.html`,
                `${bakedSiteDir}/grapher/exports/${slug}.png`,
            ] //, `${BAKED_SITE_DIR}/grapher/exports/${slug}.svg`]
            await Promise.all(paths.map((p) => fs.unlink(p)))
            paths.map((p) => console.log(p))
        } catch (err) {
            console.error(err)
        }
    }
}

export interface BakeSingleGrapherChartArguments {
    id: number
    config: string
    bakedSiteDir: string
    slug: string
    imageMetadataDictionary: Record<string, DbEnrichedImage>
}

export const bakeSingleGrapherChart = async (
    args: BakeSingleGrapherChartArguments,
    knex: db.KnexReadonlyTransaction
) => {
    const grapher: GrapherInterface = JSON.parse(args.config)
    grapher.id = args.id

    // Avoid baking paths that have an Explorer redirect.
    // Redirects take precedence.
    if (isPathRedirectedToExplorer(`/grapher/${grapher.slug}`)) {
        console.log(`⏩ ${grapher.slug} redirects to explorer`)
        return
    }

    await bakeGrapherPageAndVariablesPngAndSVGIfChanged(
        args.bakedSiteDir,
        args.imageMetadataDictionary,
        grapher,
        knex
    )
    return args
}

export const bakeAllChangedGrapherPagesVariablesPngSvgAndDeleteRemovedGraphers =
    async (bakedSiteDir: string, knex: db.KnexReadonlyTransaction) => {
        const chartsToBake = await knexRaw<
            Pick<DbPlainChart, "id"> & {
                config: DbRawChartConfig["full"]
                slug: string
            }
        >(
            knex,
            `-- sql
                    SELECT
                        c.id,
                        cc.full as config,
                        cc.slug
                    FROM charts c
                    JOIN chart_configs cc ON c.configId = cc.id
                    WHERE JSON_EXTRACT(cc.full, "$.isPublished")=true
                    ORDER BY cc.slug ASC
                `
        )

        const newSlugs = chartsToBake.map((row) => row.slug)
        await fs.mkdirp(bakedSiteDir + "/grapher")

        // Prefetch imageMetadata instead of each grapher page fetching
        // individually. imageMetadata is used by the google docs powering rich
        // text (including images) in data pages.
        const imageMetadataDictionary = await getAllImages(knex).then(
            (images) => keyBy(images, "filename")
        )

        const jobs: BakeSingleGrapherChartArguments[] = chartsToBake.map(
            (row) => ({
                id: row.id,
                config: row.config,
                bakedSiteDir: bakedSiteDir,
                slug: row.slug,
                imageMetadataDictionary,
            })
        )

        const progressBar = new ProgressBar(
            "bake grapher page [:bar] :current/:total :elapseds :rate/s :etas :name\n",
            {
                width: 20,
                total: chartsToBake.length + 1,
                renderThrottle: 0,
            }
        )

        await pMap(
            jobs,
            async (job) => {
                // We want to run this code on multiple threads, so we need to
                // be able to use multiple transactions so that we can use
                // multiple connections to the database.
                // Read-write consistency is not a concern here, thankfully.
                await db.knexReadWriteTransaction(
                    async (knex) => await bakeSingleGrapherChart(job, knex),
                    db.TransactionCloseMode.KeepOpen
                )
                progressBar.tick({ name: `slug ${job.slug}` })
            },
            { concurrency: 10 }
        )

        await deleteOldGraphers(bakedSiteDir, excludeUndefined(newSlugs))
        progressBar.tick({ name: `✅ Deleted old graphers` })
    }
