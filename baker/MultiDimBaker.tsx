import * as _ from "lodash-es"
import * as R from "remeda"
import fs from "fs-extra"
import path from "path"
import ProgressBar from "progress"
import { stringify } from "safe-stable-stringify"
import {
    ImageMetadata,
    MultiDimDataPageConfigPreProcessed,
    MultiDimDataPageProps,
    FaqEntryKeyedByGdocIdAndFragmentId,
    MultiDimDataPageConfigEnriched,
    PostsGdocsVariablesFaqsTableName,
    DbPlainPostGdocVariableFaq,
    DbEnrichedImage,
    ArchiveMetaInformation,
    ArchiveContext,
    ArchivedPageVersion,
    DataPageRelatedResearch,
} from "@ourworldindata/types"
import { MultiDimDataPageConfig } from "@ourworldindata/utils"
import * as db from "../db/db.js"
import { getImagesByFilenames } from "../db/model/Image.js"
import { getRelatedResearchAndWritingForVariables } from "../db/model/Post.js"
import { renderToHtmlPage } from "./siteRenderers.js"
import { MultiDimDataPage } from "../site/multiDim/MultiDimDataPage.js"
import {
    ARCHIVE_BASE_URL,
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
import { MultiDimArchivalManifest } from "../serverUtils/archivalUtils.js"
import { getLatestMultiDimArchivedVersions } from "../db/model/archival/archivalDb.js"

const getLatestMultiDimArchivedVersionsIfEnabled = async (
    knex: db.KnexReadonlyTransaction,
    multiDimIds?: number[]
): Promise<Record<number, ArchivedPageVersion>> => {
    if (!ARCHIVE_BASE_URL) return {}

    return await getLatestMultiDimArchivedVersions(knex, multiDimIds)
}

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
    const faqGdocIds = _.uniq(faqRelations.map((rel) => rel.gdocId))
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
    archiveContext,
}: {
    knex: db.KnexReadonlyTransaction
    slug: string | null
    config: MultiDimDataPageConfigEnriched
    imageMetadataDictionary?: Record<string, ImageMetadata>
    isPreviewing?: boolean
    archiveContext?: ArchiveContext
}) {
    const pageConfig = MultiDimDataPageConfig.fromObject(config)
    const variableIds = getRelevantVariableIds(config)
    const faqEntries = await getFaqEntries(knex, variableIds)

    // PRIMARY TOPIC
    const primaryTopic = await getPrimaryTopic(
        knex,
        config.topicTags,
        slug ?? undefined
    )

    let tagToSlugMap: Record<string, string> = {}
    let relatedResearchCandidates: DataPageRelatedResearch[] = []
    let imageMetadata: Record<string, ImageMetadata> = {}

    // If we're baking to an archival page, then we want to skip a bunch of sections
    // where the links would break
    if (archiveContext?.type !== "archive-page") {
        // TAGS
        const fullTagToSlugMap = await getTagToSlugMap(knex)
        // Only embed the tags that are actually used by the datapage, instead of the complete JSON object with ~240 properties
        tagToSlugMap = _.pick(fullTagToSlugMap, config.topicTags ?? [])

        // Related research
        relatedResearchCandidates =
            variableIds.size > 0
                ? await getRelatedResearchAndWritingForVariables(knex, [
                      ...variableIds,
                  ])
                : []

        const relatedResearchFilenames = _.uniq(
            relatedResearchCandidates.map((r) => r.imageUrl).filter(Boolean)
        )

        if (imageMetadataDictionary) {
            imageMetadata = _.pick(
                imageMetadataDictionary,
                relatedResearchFilenames
            )
        } else {
            const images = await getImagesByFilenames(
                knex,
                relatedResearchFilenames
            )
            imageMetadata = R.indexBy(images, (image) => image.filename)
        }
    }

    let canonicalUrl: string
    if (archiveContext?.type === "archive-page") {
        canonicalUrl = archiveContext.archiveUrl
    } else {
        canonicalUrl = slug ? `${BAKED_GRAPHER_URL}/${slug}` : ""
    }

    const props = {
        baseUrl: BAKED_BASE_URL,
        canonicalUrl,
        slug,
        configObj: pageConfig.config,
        tagToSlugMap,
        faqEntries,
        primaryTopic,
        relatedResearchCandidates,
        imageMetadata,
        isPreviewing,
        archiveContext,
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

    const archivedVersion = await getLatestMultiDimArchivedVersionsIfEnabled(
        knex,
        [dbRow.id]
    )

    return renderMultiDimDataPageFromConfig({
        knex,
        slug,
        config: dbRow.config,
        archiveContext: archivedVersion[dbRow.id],
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

    const archivedVersion = await getLatestMultiDimArchivedVersionsIfEnabled(
        knex,
        [dbRow.id]
    )

    return renderMultiDimDataPageFromConfig({
        knex,
        slug: dbRow.slug,
        config: dbRow.config,
        archiveContext: archivedVersion[dbRow.id],
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
    imageMetadata: Record<string, ImageMetadata>,
    archivedVersion?: ArchiveContext
) => {
    const renderedHtml = await renderMultiDimDataPageFromConfig({
        knex,
        slug,
        config,
        imageMetadataDictionary: imageMetadata,
        archiveContext: archivedVersion,
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

    // Fetch archived versions for all multi-dim pages
    const multiDimIds = Array.from(multiDimsBySlug.values()).map(
        (row) => row.id
    )
    const archivedVersions = await getLatestMultiDimArchivedVersionsIfEnabled(
        knex,
        multiDimIds
    )

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
            imageMetadata,
            archivedVersions[row.id]
        )
        progressBar.tick({ name: slug })
    }
    const publishedSlugs = multiDimsBySlug.keys()
    const chartSlugs = await getAllPublishedChartSlugs(knex)
    const newSlugs = [...publishedSlugs, ...chartSlugs]
    await deleteOldGraphers(bakedSiteDir, newSlugs)
    progressBar.tick({ name: `✅ Deleted old multi-dim pages` })
}

// Function to bake a single multi-dim data page for archival
export const bakeSingleMultiDimDataPageForArchival = async (
    bakedSiteDir: string,
    slug: string,
    config: MultiDimDataPageConfigEnriched,
    knex: db.KnexReadonlyTransaction,
    {
        imageMetadataDictionary,
        archiveInfo,
        manifest,
    }: {
        imageMetadataDictionary?: Record<string, DbEnrichedImage>
        archiveInfo: ArchiveMetaInformation
        manifest: MultiDimArchivalManifest
    }
) => {
    const outPathHtml = `${bakedSiteDir}/grapher/${slug}.html`
    await fs.writeFile(
        outPathHtml,
        await renderMultiDimDataPageFromConfig({
            knex,
            slug,
            config,
            imageMetadataDictionary,
            isPreviewing: false,
            archiveContext: archiveInfo,
        })
    )
    const outPathManifest = `${bakedSiteDir}/grapher/${slug}.manifest.json`

    await fs.writeFile(outPathManifest, stringify(manifest, undefined, 2))
}
