import React from "react"
import { GrapherPage } from "../site/GrapherPage.js"
import { DataPageV2 } from "../site/DataPageV2.js"
import { DataPage } from "../site/DataPage.js"
import { renderToHtmlPage } from "../baker/siteRenderers.js"
import {
    excludeUndefined,
    urlToSlug,
    without,
    deserializeJSONFromHTML,
    OwidVariableDataMetadataDimensions,
    uniq,
    JsonError,
    keyBy,
    OwidGdocType,
    DimensionProperty,
    OwidVariableWithSource,
    mergePartialGrapherConfigs,
    OwidChartDimensionInterface,
    compact,
    OwidGdocInterface,
    merge,
    EnrichedFaq,
    FaqEntryData,
    FaqDictionary,
    partition,
} from "@ourworldindata/utils"
import {
    getRelatedArticles,
    getRelatedCharts,
    getRelatedChartsForVariable,
    isWordpressAPIEnabled,
    isWordpressDBEnabled,
} from "../db/wpdb.js"
import fs from "fs-extra"
import * as lodash from "lodash"
import { bakeGraphersToPngs } from "./GrapherImageBaker.js"
import {
    OPTIMIZE_SVG_EXPORTS,
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
    MAX_NUM_BAKE_PROCESSES,
    ADMIN_BASE_URL,
} from "../settings/serverSettings.js"
import * as db from "../db/db.js"
import { glob } from "glob"
import { isPathRedirectedToExplorer } from "../explorerAdminServer/ExplorerRedirects.js"
import { bySlug, getPostBySlug, parsePostAuthors } from "../db/model/Post.js"
import { GrapherInterface } from "@ourworldindata/grapher"
import workerpool from "workerpool"
import ProgressBar from "progress"
import {
    getVariableData,
    getVariableMetadata,
    getMergedGrapherConfigForVariable,
} from "../db/model/Variable.js"
import {
    getDatapageDataV2,
    getDatapageGdoc,
    getDatapageJson,
    parseGdocContentFromAllowedLevelOneHeadings,
} from "../datapage/Datapage.js"
import { slugify_topic } from "../site/DataPageV2Content.js"
import { ExplorerProgram } from "../explorer/ExplorerProgram.js"
import { Image } from "../db/model/Image.js"
import { logErrorAndMaybeSendToBugsnag } from "../serverUtils/errorLog.js"

import { parseFaqs } from "../db/model/Gdoc/rawToEnriched.js"
import { GdocPost } from "../db/model/Gdoc/GdocPost.js"
import { getShortPageCitation } from "../site/gdocs/utils.js"

/**
 *
 * Render a datapage if available, otherwise render a grapher page.
 *
 * Rendering a datapage requires a datapage JSON file to be present in the
 * owid-content repository, and optionally a companion gdoc to be registered in
 * the posts_gdocs table
 */
export const renderDataPageOrGrapherPage = async (
    grapher: GrapherInterface,
    publishedExplorersBySlug?: Record<string, ExplorerProgram>,
    imageMetadataDictionary?: Record<string, Image>
) => {
    const variableIds = uniq(grapher.dimensions!.map((d) => d.variableId))
    // this shows that multi-metric charts are not really supported, and will
    // render a datapage corresponding to the first variable found.
    const id = variableIds[0]

    // Get the datapage JSON file from the owid-content git repo that has
    // been updated and pulled separately by an author.
    const { datapageJson, parseErrors } = await getDatapageJson(id)

    // When baking, a single error by datapage will be sent to slack
    if (parseErrors.length > 0) {
        logErrorAndMaybeSendToBugsnag(
            new JsonError(
                `Data page error in ${id}.json: please check ${ADMIN_BASE_URL}/admin/grapher/${grapher.slug}`
            )
        )
    }

    // Fallback to rendering a regular grapher page whether the datapage JSON
    // wasn't found or failed to parse or if the datapage is not fully
    // configured for publishing yet
    if (
        // This could be folded into the showDataPageOnChartIds check below, but
        // is kept separate to reiterate that that abscence of a datapageJson leads to
        // rendering a grapher page
        !datapageJson ||
        parseErrors.length > 0 ||
        // We only want to render datapages on selected charts, even if the
        // variable found on the chart has a datapage configuration.
        !grapher.id ||
        !datapageJson.showDataPageOnChartIds.includes(grapher.id) ||
        // Fall back to rendering a regular grapher page if the datapage is not
        // published
        datapageJson.status !== "published"
    )
        return renderGrapherPage(grapher)

    if (!datapageJson.googleDocEditLink)
        return renderToHtmlPage(
            <DataPage
                grapher={grapher}
                variableId={id}
                datapageJson={datapageJson}
                baseUrl={BAKED_BASE_URL}
                baseGrapherUrl={BAKED_GRAPHER_URL}
                isPreviewing={false}
            />
        )

    // Enrich the datapage JSON with all the published charts this variable is
    // being used in (aka "related charts") if none have been defined manually.
    // We also want to exclude from the list the chart that is displayed at the
    // top of the page to avoid the unnecessary redundancy.
    datapageJson.allCharts =
        datapageJson.allCharts ??
        (await getRelatedChartsForVariable(id, [grapher.id]))

    // Compliment the text-only content from the JSON with rich text from the
    // companion gdoc, if any
    const datapageGdoc = await getDatapageGdoc(
        datapageJson.googleDocEditLink,
        false,
        publishedExplorersBySlug
    )

    // A datapage gdoc is optional. However, if a gdoc is referenced in the
    // JSON, we assume the gdoc is expected to be used. Additionally, we need
    // the datapage gdoc to be published so that images in the gdoc content are
    // baked in bakeGdriveImages() (see also apiRouter.put("/gdocs/:id")). We
    // also check that the datapage gdoc is of type "fragment" so that it
    // doesn't get a URL when baked. If any of these conditions is not met, we
    // log an error and fall back to a grapher page.
    const dataPageNotPublishedError = `The data page for variable ${datapageJson.title} (${id}) has not been published.`
    if (!datapageGdoc) {
        logErrorAndMaybeSendToBugsnag(
            new JsonError(
                `${dataPageNotPublishedError} Please check that the googleDocEditLink ${datapageJson.googleDocEditLink} is correct.`
            )
        )
        return renderGrapherPage(grapher)
    }

    if (
        !datapageGdoc?.published ||
        datapageGdoc.content.type !== OwidGdocType.Fragment
    ) {
        logErrorAndMaybeSendToBugsnag(
            new JsonError(
                `${dataPageNotPublishedError} Please check that ${ADMIN_BASE_URL}/admin/gdocs/${datapageGdoc.id}/preview has been published as a fragment.`
            )
        )
        return renderGrapherPage(grapher)
    }

    // When baking, we get the imageMetadata once for all datapages in
    // bakeAllChangedGrapherPagesVariablesPngSvgAndDeleteRemovedGraphers()
    // rather than for each individual data page. We then attach it to the
    // current datapageGdoc.
    datapageGdoc.imageMetadata = imageMetadataDictionary

    const datapageGdocContent =
        parseGdocContentFromAllowedLevelOneHeadings(datapageGdoc)

    // Passing `datapageGdocContent` as a separate prop rather than weaving it
    // into datapageGdoc to keep the concept of "Gdoc" clearer
    return renderToHtmlPage(
        <DataPage
            grapher={grapher}
            variableId={id}
            datapageJson={datapageJson}
            datapageGdoc={datapageGdoc}
            datapageGdocContent={datapageGdocContent}
            baseUrl={BAKED_BASE_URL}
            baseGrapherUrl={BAKED_GRAPHER_URL}
            isPreviewing={false}
        />
    )
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

export async function renderDataPageV2({
    variableId,
    variableMetadata,
    isPreviewing,
    pageGrapher,
    publishedExplorersBySlug,
}: {
    variableId: number
    variableMetadata: OwidVariableWithSource
    isPreviewing: boolean
    pageGrapher?: GrapherInterface
    publishedExplorersBySlug?: Record<string, ExplorerProgram>
}) {
    const grapherConfigForVariable =
        await getMergedGrapherConfigForVariable(variableId)
    const grapher = mergePartialGrapherConfigs(
        grapherConfigForVariable,
        pageGrapher
    )

    const faqDocs = compact(
        uniq(variableMetadata.presentation?.faqs?.map((faq) => faq.gdocId))
    )
    const gdocFetchPromises = faqDocs.map((gdocId) =>
        getDatapageGdoc(gdocId, isPreviewing, publishedExplorersBySlug)
    )
    const gdocs = await Promise.all(gdocFetchPromises)
    const gdocIdToFragmentIdToBlock: Record<string, FaqDictionary> = {}
    gdocs.forEach((gdoc) => {
        if (!gdoc) return
        const faqs = parseFaqs(gdoc.content.faqs, gdoc.id)
        gdocIdToFragmentIdToBlock[gdoc.id] = faqs.faqs
    })

    const linkedCharts: OwidGdocInterface["linkedCharts"] = merge(
        {},
        ...compact(gdocs.map((gdoc) => gdoc?.linkedCharts))
    )
    const linkedDocuments: OwidGdocInterface["linkedDocuments"] = merge(
        {},
        ...compact(gdocs.map((gdoc) => gdoc?.linkedDocuments))
    )
    const imageMetadata: OwidGdocInterface["imageMetadata"] = merge(
        {},
        ...compact(gdocs.map((gdoc) => gdoc?.imageMetadata))
    )
    const relatedCharts: OwidGdocInterface["relatedCharts"] = gdocs.flatMap(
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
        grapherConfigForVariable ?? {}
    )

    const firstTopicTag = datapageData.topicTagsLinks?.[0]

    if (firstTopicTag) {
        const gdoc = await GdocPost.findOne({
            where: {
                slug: slugify_topic(firstTopicTag),
            },
            relations: ["tags"],
        })
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
            const post = await bySlug(slugify_topic(firstTopicTag))
            if (post) {
                const authors = parsePostAuthors(post.authors)
                const citation = getShortPageCitation(
                    authors,
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
    return renderToHtmlPage(
        <DataPageV2
            grapher={grapher}
            datapageData={datapageData}
            baseUrl={BAKED_BASE_URL}
            baseGrapherUrl={BAKED_GRAPHER_URL}
            isPreviewing={isPreviewing}
            faqEntries={faqEntries}
        />
    )
}

/**
 *
 * Similar to renderDataPageOrGrapherPage(), but for admin previews
 */
export const renderPreviewDataPageOrGrapherPage = async (
    grapher: GrapherInterface,
    publishedExplorersBySlug?: Record<string, ExplorerProgram>
) => {
    // If we have a single Y variable and that one has a schema version >= 2,
    // meaning it has the metadata to render a datapage, then we show the datapage
    // based on this information. Otherwise we see if there is a legacy datapage.json
    // available and if all else fails we render a classic Grapher page.
    const yVariableIds = grapher
        .dimensions!.filter((d) => d.property === DimensionProperty.y)
        .map((d) => d.variableId)
    if (yVariableIds.length === 1) {
        const variableId = yVariableIds[0]
        const variableMetadata = await getVariableMetadata(variableId)

        if (
            variableMetadata.schemaVersion !== undefined &&
            variableMetadata.schemaVersion >= 2
        ) {
            return await renderDataPageV2({
                variableId,
                variableMetadata,
                isPreviewing: true,
                pageGrapher: grapher,
                publishedExplorersBySlug,
            })
        }
    }
    const variableIds = uniq(grapher.dimensions!.map((d) => d.variableId))
    // this shows that multi-metric charts are not really supported, and will
    // render a datapage corresponding to the first variable found.
    const id = variableIds[0]

    // Get the datapage JSON file from the owid-content git repo that has
    // been updated and pulled separately by an author.
    const { datapageJson, parseErrors } = await getDatapageJson(id)

    // When previewing a datapage we want to show all discrepancies with the
    // expected JSON schema in the browser.
    if (parseErrors.length > 0)
        return renderToHtmlPage(
            <pre>{JSON.stringify(parseErrors, null, 2)}</pre>
        )

    // Fallback to rendering a regular grapher page whether the datapage JSON
    // wasn't found or if it is not set to override the current grapher page
    if (
        // This could be folded into the showDataPageOnChartIds check below, but
        // is kept separate to reiterate that that abscence of a datapageJson leads to
        // rendering a grapher page
        !datapageJson ||
        // We only want to render datapages on selected charts, even if the
        // variable found on the chart has a datapage configuration.
        !grapher.id ||
        !datapageJson.showDataPageOnChartIds.includes(grapher.id)
    )
        return renderGrapherPage(grapher)

    // Enrich the datapage JSON with all the published charts this variable is
    // being used in (aka "related charts") if none have been defined manually.
    // We also want to exclude from the list the chart that is displayed at the
    // top of the page to avoid the unnecessary redundancy.
    datapageJson.allCharts =
        datapageJson.allCharts ??
        (await getRelatedChartsForVariable(id, [grapher.id]))

    if (!datapageJson.googleDocEditLink)
        return renderToHtmlPage(
            <DataPage
                grapher={grapher}
                variableId={id}
                datapageJson={datapageJson}
                baseUrl={BAKED_BASE_URL}
                baseGrapherUrl={BAKED_GRAPHER_URL}
                isPreviewing={false}
            />
        )

    // Compliment the text-only content from the JSON with rich text from the
    // companion gdoc
    const datapageGdoc = await getDatapageGdoc(
        datapageJson.googleDocEditLink,
        true,
        publishedExplorersBySlug
    )

    const datapageGdocContent =
        parseGdocContentFromAllowedLevelOneHeadings(datapageGdoc)

    // Passing `datapageGdocContent` as a separate prop rather than weaving it
    // into datapageGdoc to keep the concept of "Gdoc" clearer
    return renderToHtmlPage(
        <DataPage
            grapher={grapher}
            variableId={id}
            datapageJson={datapageJson}
            datapageGdoc={datapageGdoc}
            datapageGdocContent={datapageGdocContent}
            baseUrl={BAKED_BASE_URL}
            baseGrapherUrl={BAKED_GRAPHER_URL}
            isPreviewing={true}
        />
    )
}

const renderGrapherPage = async (grapher: GrapherInterface) => {
    const postSlug = urlToSlug(grapher.originUrl || "")
    const post = postSlug ? await getPostBySlug(postSlug) : undefined
    const relatedCharts =
        post && isWordpressDBEnabled
            ? await getRelatedCharts(post.id)
            : undefined
    const relatedArticles =
        grapher.id && isWordpressAPIEnabled
            ? await getRelatedArticles(grapher.id)
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
    grapher: GrapherInterface
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
        await renderDataPageOrGrapherPage(grapher, {}, imageMetadataDictionary)
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
    args: BakeSingleGrapherChartArguments
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
        grapher
    )
    return args
}

export const bakeAllChangedGrapherPagesVariablesPngSvgAndDeleteRemovedGraphers =
    async (bakedSiteDir: string) => {
        const chartsToBake: { id: number; config: string; slug: string }[] =
            await db.queryMysql(`
                SELECT
                    id, config, config->>'$.slug' as slug
                FROM charts WHERE JSON_EXTRACT(config, "$.isPublished")=true
                ORDER BY JSON_EXTRACT(config, "$.slug") ASC
                `)

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

        if (MAX_NUM_BAKE_PROCESSES === 1) {
            await Promise.all(
                jobs.map(async (job) => {
                    await bakeSingleGrapherChart(job)
                    progressBar.tick({ name: `slug ${job.slug}` })
                })
            )
        } else {
            const poolOptions = {
                minWorkers: 2,
                maxWorkers: MAX_NUM_BAKE_PROCESSES,
            }
            const pool = workerpool.pool(__dirname + "/worker.js", poolOptions)
            try {
                await Promise.all(
                    jobs.map((job) =>
                        pool.exec("bakeSingleGrapherChart", [job]).then(() =>
                            progressBar.tick({
                                name: `Baked chart ${job.slug}`,
                            })
                        )
                    )
                )
            } finally {
                await pool.terminate(true)
            }
        }

        await deleteOldGraphers(bakedSiteDir, excludeUndefined(newSlugs))
        progressBar.tick({ name: `✅ Deleted old graphers` })
    }
