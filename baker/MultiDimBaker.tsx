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

const getFaqEntries = async (
    knex: db.KnexReadonlyTransaction,
    variableIds: Iterable<number>
): Promise<FaqEntryKeyedByGdocIdAndFragmentId> => {
    const faqRelations = await getFaqRelationsFromDb(knex, [...variableIds])
    const faqGdocIds = uniq(faqRelations.map((rel) => rel.gdocId))
    const faqGdocs = await fetchAndParseFaqs(knex, faqGdocIds, {
        isPreviewing: false,
    })

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
    // TAGS
    const tagToSlugMap = await getTagToSlugMap(knex)
    // Only embed the tags that are actually used by the datapage, instead of the complete JSON object with ~240 properties
    const minimalTagToSlugMap = pick(tagToSlugMap, config.topicTags ?? [])
    const pageConfig = MultiDimDataPageConfig.fromObject(config)
    const variableIds = getRelevantVariableIds(config)
    const faqEntries = await getFaqEntries(knex, variableIds)

    // PRIMARY TOPIC
    const primaryTopic = await getPrimaryTopic(
        knex,
        config.topicTags,
        slug ?? undefined
    )

    // Related research
    const relatedResearchCandidates =
        variableIds.size > 0
            ? await getRelatedResearchAndWritingForVariables(knex, [
                  ...variableIds,
              ])
            : []

    const relatedResearchFilenames = uniq(
        relatedResearchCandidates.map((r) => r.imageUrl).filter(Boolean)
    )

    let imageMetadata: Record<string, ImageMetadata>
    if (imageMetadataDictionary) {
        imageMetadata = pick(imageMetadataDictionary, relatedResearchFilenames)
    } else {
        const images = await getImagesByFilenames(
            knex,
            relatedResearchFilenames
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

    return renderMultiDimDataPageFromProps(props)
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
    return renderToHtmlPage(<MultiDimDataPage {...props} />)
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
