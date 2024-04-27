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
    mergePartialGrapherConfigs,
    compact,
    partition,
} from "@ourworldindata/utils"
import fs from "fs-extra"
import * as lodash from "lodash"
import { bakeGraphersToPngs } from "./GrapherImageBaker.js"
import {
    OPTIMIZE_SVG_EXPORTS,
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../settings/serverSettings.js"
import * as db from "../db/db.js"
import { glob } from "glob"
import { isPathRedirectedToExplorer } from "../explorerAdminServer/ExplorerRedirects.js"
import {
    getPostEnrichedBySlug,
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
    EnrichedFaq,
    FaqEntryData,
    FaqDictionary,
    ImageMetadata,
    OwidGdocBaseInterface,
    FullDatapageData,
} from "@ourworldindata/types"
import ProgressBar from "progress"
import {
    getVariableData,
    getMergedGrapherConfigForVariable,
    getVariableOfDatapageIfApplicable,
} from "../db/model/Variable.js"
import { getDatapageDataV2, getDatapageGdoc } from "./DatapageHelpers.js"
import { Image, getAllImages } from "../db/model/Image.js"
import { logErrorAndMaybeSendToBugsnag } from "../serverUtils/errorLog.js"

import { parseFaqs } from "../db/model/Gdoc/rawToEnriched.js"
import { getShortPageCitation } from "../site/gdocs/utils.js"
import { getSlugForTopicTag, getTagToSlugMap } from "./GrapherBakingUtils.js"
import { knexRaw } from "../db/db.js"
import { getRelatedChartsForVariable } from "../db/model/Chart.js"
import pMap from "p-map"
import { getGdocBaseObjectBySlug } from "../db/model/Gdoc/GdocFactory.js"
import { fetchDataPageV2Data } from "./DatapageTools.js"

const renderDatapageIfApplicable = async (
    grapher: GrapherInterface,
    isPreviewing: boolean,
    knex: db.KnexReadWriteTransaction,
    imageMetadataDictionary?: Record<string, Image>
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

// TODO: this transaction is only RW because somewhere inside it we fetch images
export const renderDataPageOrGrapherPage = async (
    grapher: GrapherInterface,
    knex: db.KnexReadWriteTransaction,
    imageMetadataDictionary?: Record<string, Image>
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

    // TODO: this transaction is only RW because somewhere inside it we fetch images
    knex: db.KnexReadWriteTransaction
) {
    const { grapher, datapageData, imageMetadata, faqEntries, tagToSlugMap } =
        await fetchDataPageV2Data(
            variableId,
            variableMetadata,
            isPreviewing,
            useIndicatorGrapherConfigs,
            pageGrapher,
            imageMetadataDictionary,
            knex
        )
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

    // TODO: this transaction is only RW because somewhere inside it we fetch images
    knex: db.KnexReadWriteTransaction
) => {
    const datapage = await renderDatapageIfApplicable(grapher, true, knex)
    if (datapage) return datapage

    return renderGrapherPage(grapher, knex)
}

const renderGrapherPage = async (
    grapher: GrapherInterface,
    knex: db.KnexReadonlyTransaction
) => {
    const postSlug = urlToSlug(grapher.originUrl || "")
    const post = postSlug
        ? await getPostEnrichedBySlug(knex, postSlug)
        : undefined
    const relatedCharts = post
        ? await getPostRelatedCharts(knex, post.id)
        : undefined
    const relatedArticles = grapher.id
        ? await getRelatedArticles(knex, grapher.id)
        : undefined

    return renderToHtmlPage(
        <GrapherPage
            grapher={grapher}
            post={post}
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
    imageMetadataDictionary: Record<string, Image>,
    grapher: GrapherInterface,
    knex: db.KnexReadWriteTransaction
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
        await bakeGraphersToPngs(
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
    imageMetadataDictionary: Record<string, Image>
}

export const bakeSingleGrapherChart = async (
    args: BakeSingleGrapherChartArguments,

    // TODO: this transaction is only RW because somewhere inside it we fetch images
    knex: db.KnexReadWriteTransaction
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
    // TODO: this transaction is only RW because somewhere inside it we fetch images
    async (bakedSiteDir: string, knex: db.KnexReadWriteTransaction) => {
        const chartsToBake: { id: number; config: string; slug: string }[] =
            await knexRaw(
                knex,
                `
                SELECT
                    id, config, config->>'$.slug' as slug
                FROM charts WHERE JSON_EXTRACT(config, "$.isPublished")=true
                ORDER BY JSON_EXTRACT(config, "$.slug") ASC
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
            }
        )

        await pMap(
            jobs,
            async (job) => {
                // TODO: not sure if the shared transaction will be an issue - I think it should be fine but just to put a flag here
                // that this could be causing issues
                await bakeSingleGrapherChart(job, knex)
                progressBar.tick({ name: `slug ${job.slug}` })
            },
            { concurrency: 10 }
        )

        await deleteOldGraphers(bakedSiteDir, excludeUndefined(newSlugs))
        progressBar.tick({ name: `✅ Deleted old graphers` })
    }
