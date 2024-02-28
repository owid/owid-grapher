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
    merge,
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
    OwidGdocPostInterface,
    EnrichedFaq,
    FaqEntryData,
    FaqDictionary,
    ImageMetadata,
} from "@ourworldindata/types"
import ProgressBar from "progress"
import {
    getVariableData,
    getMergedGrapherConfigForVariable,
    getVariableOfDatapageIfApplicable,
} from "../db/model/Variable.js"
import { getDatapageDataV2, getDatapageGdoc } from "./DatapageHelpers.js"
import { Image } from "../db/model/Image.js"
import { logErrorAndMaybeSendToBugsnag } from "../serverUtils/errorLog.js"

import { parseFaqs } from "../db/model/Gdoc/rawToEnriched.js"
import { GdocPost } from "../db/model/Gdoc/GdocPost.js"
import { getShortPageCitation } from "../site/gdocs/utils.js"
import { getSlugForTopicTag, getTagToSlugMap } from "./GrapherBakingUtils.js"
import { knexRaw } from "../db/db.js"
import { getRelatedChartsForVariable } from "../db/model/Chart.js"
import pMap from "p-map"

const renderDatapageIfApplicable = async (
    grapher: GrapherInterface,
    isPreviewing: boolean,
    knex: db.KnexReadonlyTransaction,
    imageMetadataDictionary?: Record<string, Image>
) => {
    const variable = await getVariableOfDatapageIfApplicable(grapher)

    if (!variable) return undefined

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

type EnrichedFaqLookupError = {
    type: "error"
    error: string
}

type EnrichedFaqLookupSuccess = {
    type: "success"
    enrichedFaq: EnrichedFaq
}

type EnrichedFaqLookupResult = EnrichedFaqLookupError | EnrichedFaqLookupSuccess

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
        variableId,
        knex
    )
    // Only merge the grapher config on the indicator if the caller tells us to do so -
    // this is true for preview pages for datapages on the indicator level but false
    // if we are on Grapher pages. Once we have a good way in the grapher admin for how
    // to use indicator level defaults, we should reconsider how this works here.
    const grapher = useIndicatorGrapherConfigs
        ? mergePartialGrapherConfigs(grapherConfigForVariable, pageGrapher)
        : pageGrapher ?? {}

    const faqDocs = compact(
        uniq(variableMetadata.presentation?.faqs?.map((faq) => faq.gdocId))
    )
    const gdocFetchPromises = faqDocs.map((gdocId) =>
        getDatapageGdoc(gdocId, isPreviewing)
    )
    const gdocs = await Promise.all(gdocFetchPromises)
    const gdocIdToFragmentIdToBlock: Record<string, FaqDictionary> = {}
    gdocs.forEach((gdoc) => {
        if (!gdoc) return
        const faqs = parseFaqs(gdoc.content.faqs, gdoc.id)
        gdocIdToFragmentIdToBlock[gdoc.id] = faqs.faqs
    })

    const linkedCharts: OwidGdocPostInterface["linkedCharts"] = merge(
        {},
        ...compact(gdocs.map((gdoc) => gdoc?.linkedCharts))
    )
    const linkedDocuments: OwidGdocPostInterface["linkedDocuments"] = merge(
        {},
        ...compact(gdocs.map((gdoc) => gdoc?.linkedDocuments))
    )
    const imageMetadata: OwidGdocPostInterface["imageMetadata"] = merge(
        {},
        imageMetadataDictionary,
        ...compact(gdocs.map((gdoc) => gdoc?.imageMetadata))
    )
    const relatedCharts: OwidGdocPostInterface["relatedCharts"] = gdocs.flatMap(
        (gdoc) => gdoc?.relatedCharts ?? []
    )

    const resolvedFaqsResults: EnrichedFaqLookupResult[] = variableMetadata
        .presentation?.faqs
        ? variableMetadata.presentation.faqs.map((faq) => {
              const enrichedFaq = gdocIdToFragmentIdToBlock[faq.gdocId]?.[
                  faq.fragmentId
              ] as EnrichedFaq | undefined
              if (!enrichedFaq)
                  return {
                      type: "error",
                      error: `Could not find fragment ${faq.fragmentId} in gdoc ${faq.gdocId}`,
                  }
              return {
                  type: "success",
                  enrichedFaq,
              }
          })
        : []

    const [resolvedFaqs, faqResolveErrors] = partition(
        resolvedFaqsResults,
        (result) => result.type === "success"
    ) as [EnrichedFaqLookupSuccess[], EnrichedFaqLookupError[]]

    if (faqResolveErrors.length > 0) {
        for (const error of faqResolveErrors) {
            logErrorAndMaybeSendToBugsnag(
                new JsonError(
                    `Data page error in finding FAQs for variable ${variableId}: ${error.error}`
                )
            )
        }
    }

    const faqEntries: FaqEntryData = {
        linkedCharts,
        linkedDocuments,
        imageMetadata,
        relatedCharts,
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

    let slug = ""
    if (firstTopicTag) {
        try {
            slug = await getSlugForTopicTag(firstTopicTag)
        } catch (error) {
            logErrorAndMaybeSendToBugsnag(
                `Datapage with variableId "${variableId}" and title "${datapageData.title.title}" is using "${firstTopicTag}" as its primary tag, which we are unable to resolve to a tag in the grapher DB`
            )
        }
        let gdoc: GdocPost | null = null
        if (slug) {
            gdoc = await GdocPost.findOne({
                where: {
                    slug,
                },
                relations: ["tags"],
            })
        }
        if (gdoc) {
            const citation = getShortPageCitation(
                gdoc.content.authors,
                gdoc.content.title ?? "",
                gdoc?.publishedAt
            )
            datapageData.primaryTopic = {
                topicTag: firstTopicTag,
                citation,
            }
        } else {
            const post = await getPostEnrichedBySlug(knex, slug)
            if (post) {
                const authors = post.authors
                const citation = getShortPageCitation(
                    authors ?? [],
                    post.title,
                    post.published_at
                )
                datapageData.primaryTopic = {
                    topicTag: firstTopicTag,
                    citation,
                }
            }
        }
    }

    // Get the charts this variable is being used in (aka "related charts")
    // and exclude the current chart to avoid duplicates
    datapageData.allCharts = await getRelatedChartsForVariable(
        variableId,
        grapher && "id" in grapher ? [grapher.id as number] : []
    )

    datapageData.relatedResearch =
        await getRelatedResearchAndWritingForVariable(variableId)

    const tagToSlugMap = await getTagToSlugMap()

    return renderToHtmlPage(
        <DataPageV2
            grapher={grapher}
            datapageData={datapageData}
            baseUrl={BAKED_BASE_URL}
            baseGrapherUrl={BAKED_GRAPHER_URL}
            isPreviewing={isPreviewing}
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
    await db.getConnection()

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
        const imageMetadataDictionary = await Image.find().then((images) =>
            keyBy(images, "filename")
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
                db.knexReadonlyTransaction((trx) =>
                    bakeSingleGrapherChart(job, trx)
                )
                progressBar.tick({ name: `slug ${job.slug}` })
            },
            { concurrency: 10 }
        )

        await deleteOldGraphers(bakedSiteDir, excludeUndefined(newSlugs))
        progressBar.tick({ name: `✅ Deleted old graphers` })
    }
