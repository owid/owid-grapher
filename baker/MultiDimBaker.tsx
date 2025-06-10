import * as R from "remeda"
import fs from "fs-extra"
import path from "path"
import ProgressBar from "progress"
import {
    ImageMetadata,
    MultiDimDataPageConfigPreProcessed,
    MultiDimDataPageProps,
    FaqEntryKeyedByGdocIdAndFragmentId,
    MultiDimDataPageConfigEnriched,
    PostsGdocsVariablesFaqsTableName,
    DbPlainPostGdocVariableFaq,
} from "@ourworldindata/types"
import { MultiDimDataPageConfig, pick, uniq } from "@ourworldindata/utils"
import * as db from "../db/db.js"
import { getImagesByFilenames } from "../db/model/Image.js"
import { getRelatedResearchAndWritingForVariables } from "../db/model/Post.js"
import { renderToHtmlPage } from "./siteRenderers.js"
import { MultiDimDataPage } from "../site/multiDim/MultiDimDataPage.js"
import {
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../settings/serverSettings.js"
import { deleteOldGraphers, getTagToSlugMap } from "./GrapherBakingUtils.js"
import { getVariableMetadata } from "../db/model/Variable.js"
import pMap from "p-map"
import { fetchAndParseFaqs, getPrimaryTopic } from "./DatapageHelpers.js"
import { getAllPublishedChartSlugs } from "../db/model/Chart.js"
import {
    getAllPublishedMultiDimDataPagesBySlug,
    getMultiDimDataPageByCatalogPath,
    getMultiDimDataPageBySlug,
} from "../db/model/MultiDimDataPage.js"

export function getRelevantVariableIds(
    config: MultiDimDataPageConfigPreProcessed
) {
    // A "relevant" variable id is the first y indicator of each view
    const allIndicatorIds = config.views
        .map((view) => view.indicators.y?.[0]?.id)
        .filter((id) => id !== undefined)

    return new Set(allIndicatorIds)
}

export async function getRelevantVariableMetadata(
    variableIds: Iterable<number>
) {
    const metadata = await pMap(
        variableIds,
        async (id) => {
            return getVariableMetadata(id)
        },
        { concurrency: 10 }
    )

    return R.indexBy(metadata, (m) => m.id)
}

async function getFaqRelationsFromDb(
    knex: db.KnexReadonlyTransaction,
    variableIds: number[]
) {
    return await knex<DbPlainPostGdocVariableFaq>(
        PostsGdocsVariablesFaqsTableName
    )
        .whereIn("variableId", variableIds)
        .orderBy("displayOrder", "asc")
}

export const getFaqEntries = async (
    knex: db.KnexReadonlyTransaction,
    variableIds: Iterable<number>
): Promise<FaqEntryKeyedByGdocIdAndFragmentId> => {
    const variableIdsArray = [...variableIds]
    console.log(
        `[DEBUG] getFaqEntries - Starting for ${variableIdsArray.length} variable IDs`
    )
    console.time(`faq-entries-${variableIdsArray.length}`)

    console.log(`[DEBUG] getFaqEntries - Getting FAQ relations from database`)
    console.time(`faq-relations-${variableIdsArray.length}`)
    const faqRelations = await getFaqRelationsFromDb(knex, variableIdsArray)
    console.timeEnd(`faq-relations-${variableIdsArray.length}`)
    console.log(
        `[DEBUG] getFaqEntries - Got ${faqRelations.length} FAQ relations`
    )

    const faqGdocIds = uniq(faqRelations.map((rel) => rel.gdocId))
    console.log(
        `[DEBUG] getFaqEntries - Found ${faqGdocIds.length} unique FAQ gdoc IDs`
    )

    console.log(`[DEBUG] getFaqEntries - Fetching and parsing FAQs`)
    console.time(`fetch-parse-faqs-${variableIdsArray.length}`)
    const faqGdocs = await fetchAndParseFaqs(knex, faqGdocIds, {
        isPreviewing: false,
    })
    console.timeEnd(`fetch-parse-faqs-${variableIdsArray.length}`)
    console.log(
        `[DEBUG] getFaqEntries - Fetched FAQs for ${Object.keys(faqGdocs).length} gdoc IDs`
    )

    const faqs = faqRelations.reduce(
        (acc, { gdocId, fragmentId }) => {
            const faqContent = faqGdocs[gdocId]?.[fragmentId]?.content
            if (faqContent) {
                acc[gdocId] ??= {}
                acc[gdocId][fragmentId] = faqContent
            }
            return acc
        },
        {} as FaqEntryKeyedByGdocIdAndFragmentId["faqs"]
    )

    console.timeEnd(`faq-entries-${variableIdsArray.length}`)
    console.log(
        `[DEBUG] getFaqEntries - Completed with ${Object.keys(faqs).length} FAQ gdoc entries`
    )

    return { faqs }
}

export async function renderMultiDimDataPageFromConfig({
    knex,
    slug,
    config,
    imageMetadataDictionary,
    isPreviewing = false,
}: {
    knex: db.KnexReadonlyTransaction
    slug: string | null
    config: MultiDimDataPageConfigEnriched
    imageMetadataDictionary?: Record<string, ImageMetadata>
    isPreviewing?: boolean
}) {
    console.log(
        `[DEBUG] renderMultiDimDataPageFromConfig - Starting for slug: ${slug}`
    )
    console.time(`mdim-render-${slug}`)

    // TAGS
    console.log(
        `[DEBUG] renderMultiDimDataPageFromConfig - Getting tag to slug map`
    )
    console.time(`mdim-render-${slug}-tags`)
    const tagToSlugMap = await getTagToSlugMap(knex)
    console.timeEnd(`mdim-render-${slug}-tags`)
    console.log(
        `[DEBUG] renderMultiDimDataPageFromConfig - Got ${Object.keys(tagToSlugMap).length} tags`
    )

    // Only embed the tags that are actually used by the datapage, instead of the complete JSON object with ~240 properties
    const minimalTagToSlugMap = pick(tagToSlugMap, config.topicTags ?? [])
    console.log(
        `[DEBUG] renderMultiDimDataPageFromConfig - Filtered to ${Object.keys(minimalTagToSlugMap).length} relevant tags`
    )

    const pageConfig = MultiDimDataPageConfig.fromObject(config)
    const variableIds = getRelevantVariableIds(config)
    console.log(
        `[DEBUG] renderMultiDimDataPageFromConfig - Found ${variableIds.size} relevant variable IDs`
    )

    console.log(
        `[DEBUG] renderMultiDimDataPageFromConfig - Getting FAQ entries`
    )
    console.time(`mdim-render-${slug}-faqs`)
    const faqEntries = await getFaqEntries(knex, variableIds)
    console.timeEnd(`mdim-render-${slug}-faqs`)
    console.log(
        `[DEBUG] renderMultiDimDataPageFromConfig - Got FAQ entries with ${Object.keys(faqEntries.faqs).length} gdoc IDs`
    )

    // PRIMARY TOPIC
    console.log(
        `[DEBUG] renderMultiDimDataPageFromConfig - Getting primary topic`
    )
    console.time(`mdim-render-${slug}-primary-topic`)
    const primaryTopic = await getPrimaryTopic(
        knex,
        config.topicTags,
        slug ?? undefined
    )
    console.timeEnd(`mdim-render-${slug}-primary-topic`)
    console.log(`[DEBUG] renderMultiDimDataPageFromConfig - Got primary topic:`)

    // Related research
    console.log(
        `[DEBUG] renderMultiDimDataPageFromConfig - Getting related research`
    )
    console.time(`mdim-render-${slug}-related-research`)
    const relatedResearchCandidates =
        variableIds.size > 0
            ? await getRelatedResearchAndWritingForVariables(knex, [
                  ...variableIds,
              ])
            : []
    console.timeEnd(`mdim-render-${slug}-related-research`)
    console.log(
        `[DEBUG] renderMultiDimDataPageFromConfig - Got ${relatedResearchCandidates.length} related research candidates`
    )

    const relatedResearchFilenames = uniq(
        relatedResearchCandidates.map((r) => r.imageUrl).filter(Boolean)
    )
    console.log(
        `[DEBUG] renderMultiDimDataPageFromConfig - Found ${relatedResearchFilenames.length} unique image filenames`
    )

    let imageMetadata: Record<string, ImageMetadata>
    if (imageMetadataDictionary) {
        console.log(
            `[DEBUG] renderMultiDimDataPageFromConfig - Using provided image metadata dictionary`
        )
        imageMetadata = pick(imageMetadataDictionary, relatedResearchFilenames)
    } else {
        console.log(
            `[DEBUG] renderMultiDimDataPageFromConfig - Fetching image metadata from database`
        )
        console.time(`mdim-render-${slug}-image-metadata`)
        const images = await getImagesByFilenames(
            knex,
            relatedResearchFilenames
        )
        console.timeEnd(`mdim-render-${slug}-image-metadata`)
        console.log(
            `[DEBUG] renderMultiDimDataPageFromConfig - Got ${images.length} images`
        )
        imageMetadata = R.indexBy(images, (image) => image.filename)
    }

    const props = {
        baseUrl: BAKED_BASE_URL,
        baseGrapherUrl: BAKED_GRAPHER_URL,
        slug,
        configObj: pageConfig.config,
        tagToSlugMap: minimalTagToSlugMap,
        faqEntries,
        primaryTopic,
        relatedResearchCandidates,
        imageMetadata,
        isPreviewing,
    }

    console.log(
        `[DEBUG] renderMultiDimDataPageFromConfig - Rendering page from props`
    )
    console.time(`mdim-render-${slug}-html-render`)
    const result = await renderMultiDimDataPageFromProps(props)
    console.timeEnd(`mdim-render-${slug}-html-render`)
    console.timeEnd(`mdim-render-${slug}`)
    console.log(
        `[DEBUG] renderMultiDimDataPageFromConfig - Completed for slug: ${slug}`
    )

    return result
}

export const renderMultiDimDataPageBySlug = async (
    knex: db.KnexReadonlyTransaction,
    slug: string,
    { onlyPublished = true }: { onlyPublished?: boolean } = {}
) => {
    const dbRow = await getMultiDimDataPageBySlug(knex, slug, { onlyPublished })
    if (!dbRow) throw new Error(`No multi-dim site found for slug: ${slug}`)

    return renderMultiDimDataPageFromConfig({
        knex,
        slug,
        config: dbRow.config,
    })
}

export async function renderMultiDimDataPageByCatalogPath(
    knex: db.KnexReadonlyTransaction,
    catalogPath: string
) {
    const dbRow = await getMultiDimDataPageByCatalogPath(knex, catalogPath)
    if (!dbRow)
        throw new Error(
            `No multi-dim site found for catalog path: ${catalogPath}`
        )

    return renderMultiDimDataPageFromConfig({
        knex,
        slug: dbRow.slug,
        config: dbRow.config,
    })
}

export const renderMultiDimDataPageFromProps = async (
    props: MultiDimDataPageProps
) => {
    console.log(
        `[DEBUG] renderMultiDimDataPageFromProps - Starting render for slug: ${props.slug}`
    )
    console.time(`html-render-${props.slug}`)
    const result = await renderToHtmlPage(<MultiDimDataPage {...props} />)
    console.timeEnd(`html-render-${props.slug}`)
    console.log(
        `[DEBUG] renderMultiDimDataPageFromProps - Completed render for slug: ${props.slug}`
    )
    return result
}

export const bakeMultiDimDataPage = async (
    knex: db.KnexReadonlyTransaction,
    bakedSiteDir: string,
    slug: string,
    config: MultiDimDataPageConfigEnriched,
    imageMetadata: Record<string, ImageMetadata>
) => {
    const renderedHtml = await renderMultiDimDataPageFromConfig({
        knex,
        slug,
        config,
        imageMetadataDictionary: imageMetadata,
    })
    const outPath = path.join(bakedSiteDir, `grapher/${slug}.html`)
    await fs.writeFile(outPath, renderedHtml)
}

export const bakeAllMultiDimDataPages = async (
    knex: db.KnexReadonlyTransaction,
    bakedSiteDir: string,
    imageMetadata: Record<string, ImageMetadata>
) => {
    const multiDimsBySlug = await getAllPublishedMultiDimDataPagesBySlug(knex)
    const progressBar = new ProgressBar(
        "bake multi-dim page [:bar] :current/:total :elapseds :rate/s :name\n",
        {
            width: 20,
            total: multiDimsBySlug.size + 1,
            renderThrottle: 0,
        }
    )
    for (const [slug, row] of multiDimsBySlug.entries()) {
        await bakeMultiDimDataPage(
            knex,
            bakedSiteDir,
            slug,
            row.config,
            imageMetadata
        )
        progressBar.tick({ name: slug })
    }
    const publishedSlugs = multiDimsBySlug.keys()
    const chartSlugs = await getAllPublishedChartSlugs(knex)
    const newSlugs = [...publishedSlugs, ...chartSlugs]
    await deleteOldGraphers(bakedSiteDir, newSlugs)
    progressBar.tick({ name: `✅ Deleted old multi-dim pages` })
}
