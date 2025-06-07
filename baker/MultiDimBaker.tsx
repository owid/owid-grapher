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
    DbEnrichedImage,
    ArchiveMetaInformation,
    ArchiveContext,
    ArchivedPageVersion,
    DataPageRelatedResearch,
} from "@ourworldindata/types"
import {
    MultiDimDataPageConfig,
    OwidVariableWithSource,
    pick,
    uniq,
} from "@ourworldindata/utils"
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
import {
    fetchAndParseFaqs,
    getPrimaryTopic,
    resolveFaqsForVariable,
} from "./DatapageHelpers.js"
import { logErrorAndMaybeCaptureInSentry } from "../serverUtils/errorLog.js"
import { getAllPublishedChartSlugs } from "../db/model/Chart.js"
import {
    getAllPublishedMultiDimDataPagesBySlug,
    getMultiDimDataPageByCatalogPath,
    getMultiDimDataPageBySlug,
} from "../db/model/MultiDimDataPage.js"
import { MultiDimArchivalManifest } from "./archival/archivalUtils.js"
import { getLatestMultiDimArchivedVersions } from "./archival/archivalChecksum.js"

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
                void logErrorAndMaybeCaptureInSentry(
                    new Error(
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

export async function renderMultiDimDataPageFromConfig({
    knex,
    slug,
    config,
    imageMetadataDictionary,
    isPreviewing = false,
    archiveInfo,
}: {
    knex: db.KnexReadonlyTransaction
    slug: string | null
    config: MultiDimDataPageConfigEnriched
    imageMetadataDictionary?: Record<string, ImageMetadata>
    isPreviewing?: boolean
    archiveInfo?: ArchiveContext
}) {
    const pageConfig = MultiDimDataPageConfig.fromObject(config)
    const variableIds = getRelevantVariableIds(config)

    // FAQs
    const variableMetaDict = await getRelevantVariableMetadata(variableIds)
    const faqEntries = await getFaqEntries(knex, config, variableMetaDict)

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
    if (archiveInfo?.type !== "archive-page") {
        // TAGS
        const fullTagToSlugMap = await getTagToSlugMap(knex)
        // Only embed the tags that are actually used by the datapage, instead of the complete JSON object with ~240 properties
        tagToSlugMap = pick(fullTagToSlugMap, config.topicTags ?? [])

        // Related research
        relatedResearchCandidates =
            variableIds.size > 0
                ? await getRelatedResearchAndWritingForVariables(knex, [
                      ...variableIds,
                  ])
                : []

        const relatedResearchFilenames = uniq(
            relatedResearchCandidates.map((r) => r.imageUrl).filter(Boolean)
        )

        if (imageMetadataDictionary) {
            imageMetadata = pick(
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
    if (archiveInfo?.type === "archive-page") {
        canonicalUrl = archiveInfo.archiveUrl
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
        archivedChartInfo: archiveInfo,
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
        archiveInfo: archivedVersion[dbRow.id],
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
        archiveInfo: archivedVersion[dbRow.id],
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
        archiveInfo: archivedVersion,
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
            archiveInfo,
        })
    )
    const outPathManifest = `${bakedSiteDir}/grapher/${slug}.manifest.json`

    await fs.writeFile(outPathManifest, stringify(manifest, undefined, 2))
}
