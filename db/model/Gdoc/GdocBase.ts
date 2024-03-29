import * as db from "../../db"
import { getUrlTarget } from "@ourworldindata/components"
import {
    LinkedChart,
    LinkedIndicator,
    keyBy,
    ImageMetadata,
    excludeUndefined,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    excludeNullish,
    traverseEnrichedBlocks,
    OwidEnrichedGdocBlock,
    Span,
    EnrichedBlockResearchAndWritingLink,
    traverseEnrichedSpan,
    uniq,
    identity,
    OwidGdocBaseInterface,
    OwidGdocPublicationContext,
    BreadcrumbItem,
    MinimalDataInsightInterface,
    OwidGdocMinimalPostInterface,
    urlToSlug,
    grabMetadataForGdocLinkedIndicator,
    GrapherTabOption,
    DbInsertPostGdocLink,
    DbPlainTag,
    formatDate,
    omit,
} from "@ourworldindata/utils"
import { BAKED_GRAPHER_URL } from "../../../settings/serverSettings.js"
import { google } from "googleapis"
import { gdocToArchie } from "./gdocToArchie.js"
import { archieToEnriched } from "./archieToEnriched.js"
import { imageStore } from "../Image.js"
import { getChartConfigById, mapSlugsToIds } from "../Chart.js"
import {
    BAKED_BASE_URL,
    BAKED_GRAPHER_EXPORTS_BASE_URL,
} from "../../../settings/clientSettings.js"
import { EXPLORERS_ROUTE_FOLDER } from "../../../explorer/ExplorerConstants.js"
import { match, P } from "ts-pattern"
import {
    extractUrl,
    getAllLinksFromResearchAndWritingBlock,
    spansToSimpleString,
} from "./gdocUtils.js"
import { OwidGoogleAuth } from "../../OwidGoogleAuth.js"
import { enrichedBlocksToMarkdown } from "./enrichedToMarkdown.js"
import {
    getVariableMetadata,
    getVariableOfDatapageIfApplicable,
} from "../Variable.js"
import { createLinkFromUrl } from "../Link.js"
import { OwidGdoc, OwidGdocContent, OwidGdocType } from "@ourworldindata/types"
import { KnexReadonlyTransaction } from "../../db"

export class GdocBase implements OwidGdocBaseInterface {
    id!: string
    slug: string = ""
    content!: OwidGdocContent
    published: boolean = false
    createdAt: Date = new Date()
    publishedAt: Date | null = null
    updatedAt: Date | null = null
    revisionId: string | null = null
    markdown: string | null = null
    publicationContext: OwidGdocPublicationContext =
        OwidGdocPublicationContext.unlisted
    breadcrumbs: BreadcrumbItem[] | null = null
    tags: DbPlainTag[] | null = null
    errors: OwidGdocErrorMessage[] = []
    imageMetadata: Record<string, ImageMetadata> = {}
    linkedCharts: Record<string, LinkedChart> = {}
    linkedIndicators: Record<number, LinkedIndicator> = {}
    linkedDocuments: Record<string, OwidGdocMinimalPostInterface> = {}
    latestDataInsights: MinimalDataInsightInterface[] = []

    _getSubclassEnrichedBlocks: (gdoc: typeof this) => OwidEnrichedGdocBlock[] =
        () => []
    _enrichSubclassContent: (content: Record<string, any>) => void = identity
    _validateSubclass: (
        knex: db.KnexReadonlyTransaction,
        gdoc: typeof this
    ) => Promise<OwidGdocErrorMessage[]> = async () => []
    _omittableFields: string[] = []

    // TODO: this transaction is only RW because somewhere inside it we fetch images
    _loadSubclassAttachments: (
        knex: db.KnexReadWriteTransaction
    ) => Promise<void> = async () => undefined

    constructor(id?: string) {
        if (id) {
            this.id = id
        }
    }

    protected typeSpecificFilenames(): string[] {
        return []
    }

    protected typeSpecificUrls(): string[] {
        return []
    }

    get enrichedBlockSources(): OwidEnrichedGdocBlock[][] {
        const enrichedBlockSources: OwidEnrichedGdocBlock[][] = excludeNullish([
            this.content.body,
            this._getSubclassEnrichedBlocks(this),
        ])

        return enrichedBlockSources
    }

    updateMarkdown(): void {
        try {
            this.markdown =
                enrichedBlocksToMarkdown(
                    this.enrichedBlockSources.flat(),
                    true
                ) ?? null
        } catch (e) {
            console.error("Error when converting content to markdown", e)
        }
    }

    get filenames(): string[] {
        const filenames: Set<string> = new Set()

        for (const filename of this.typeSpecificFilenames()) {
            if (filename) {
                filenames.add(filename)
            }
        }

        for (const enrichedBlockSource of this.enrichedBlockSources) {
            enrichedBlockSource.forEach((block) =>
                traverseEnrichedBlocks(block, (item) => {
                    if ("type" in item) {
                        if ("filename" in item && item.filename) {
                            filenames.add(item.filename)
                        }
                        if (item.type === "image" && item.smallFilename) {
                            filenames.add(item.smallFilename)
                        }
                        if (item.type === "prominent-link" && item.thumbnail) {
                            filenames.add(item.thumbnail)
                        }
                        if (item.type === "research-and-writing") {
                            const allLinks =
                                getAllLinksFromResearchAndWritingBlock(item)
                            allLinks.forEach(
                                (link: EnrichedBlockResearchAndWritingLink) => {
                                    if (link.value.filename) {
                                        filenames.add(link.value.filename)
                                    }
                                }
                            )
                        }
                        if (item.type === "key-insights") {
                            item.insights.forEach((insight) => {
                                if (insight.filename) {
                                    filenames.add(insight.filename)
                                }
                            })
                        }
                        if (item.type === "homepage-intro") {
                            item.featuredWork.forEach((featuredWork) => {
                                if (featuredWork.filename) {
                                    filenames.add(featuredWork.filename)
                                }
                            })
                        }
                    }
                    return item
                })
            )
        }

        return [...filenames]
    }

    get details(): string[] {
        const details: Set<string> = new Set()

        for (const enrichedBlockSource of this.enrichedBlockSources) {
            enrichedBlockSource.forEach((block) =>
                traverseEnrichedBlocks(
                    block,
                    (x) => x,
                    (span) => {
                        if (span.spanType === "span-dod") {
                            details.add(span.id)
                        }
                    }
                )
            )
        }

        return [...details]
    }

    get links(): DbInsertPostGdocLink[] {
        const links: DbInsertPostGdocLink[] = []

        for (const urlCandidate of this.typeSpecificUrls()) {
            const url = extractUrl(urlCandidate)
            if (url) {
                links.push(
                    createLinkFromUrl({
                        url,
                        source: this,
                        componentType: "front-matter",
                    })
                )
            }
        }

        for (const enrichedBlockSource of this.enrichedBlockSources) {
            enrichedBlockSource.forEach((block) =>
                traverseEnrichedBlocks(
                    block,
                    (block) => {
                        const extractedLinks = this.extractLinksFromBlock(block)
                        if (extractedLinks) links.push(...extractedLinks)
                    },
                    (span) => {
                        const link = this.extractLinkFromSpan(span)
                        if (link) links.push(link)
                    }
                )
            )
        }

        return links
    }

    get linkedDocumentIds(): string[] {
        return uniq(
            this.links
                .filter((link) => link.linkType === "gdoc")
                .map((link) => link.target)
        )
    }

    get linkedImageFilenames(): string[] {
        // The typing logic is a little strange here
        // `featured-image` isn't guaranteed to be on all types of Gdoc (it's a GdocPost thing)
        // but we try (and then filter nulls) because we need featured images if we're using prominent links
        // even if this method is being called on a GdocFaq (for example)
        const featuredImages = Object.values(this.linkedDocuments)
            .map((d) => d["featured-image"])
            .filter((filename?: string): filename is string => !!filename)

        return [...this.filenames, ...featuredImages]
    }

    get linkedKeyIndicatorSlugs(): string[] {
        const slugs = new Set<string>()
        for (const enrichedBlockSource of this.enrichedBlockSources) {
            for (const block of enrichedBlockSource) {
                traverseEnrichedBlocks(block, (block) => {
                    if (block.type === "key-indicator") {
                        slugs.add(urlToSlug(block.datapageUrl))
                    }
                })
            }
        }
        return [...slugs]
    }

    get linkedChartSlugs(): { grapher: string[]; explorer: string[] } {
        const { grapher, explorer } = this.links.reduce(
            (slugsByLinkType, { linkType, target }) => {
                if (linkType === "grapher" || linkType === "explorer") {
                    slugsByLinkType[linkType].add(target)
                }
                return slugsByLinkType
            },
            {
                grapher: new Set<string>(),
                explorer: new Set<string>(),
            }
        )

        this.linkedKeyIndicatorSlugs.forEach((slug) => grapher.add(slug))

        return { grapher: [...grapher], explorer: [...explorer] }
    }

    get hasAllChartsBlock(): boolean {
        let hasAllChartsBlock = false
        for (const enrichedBlockSource of this.enrichedBlockSources) {
            for (const block of enrichedBlockSource) {
                if (hasAllChartsBlock) break
                traverseEnrichedBlocks(block, (block) => {
                    if (block.type === "all-charts") {
                        hasAllChartsBlock = true
                    }
                })
            }
        }

        return hasAllChartsBlock
    }

    extractLinksFromBlock(
        block: OwidEnrichedGdocBlock
    ): DbInsertPostGdocLink[] | void {
        const links: DbInsertPostGdocLink[] = match(block)
            .with({ type: "prominent-link" }, (block) => [
                createLinkFromUrl({
                    url: block.url,
                    source: this,
                    componentType: block.type,
                    text: block.title,
                }),
            ])
            .with({ type: "chart" }, (block) => [
                createLinkFromUrl({
                    url: block.url,
                    source: this,
                    componentType: block.type,
                }),
            ])
            .with({ type: "all-charts" }, (block) =>
                block.top.map((item) =>
                    createLinkFromUrl({
                        url: item.url,
                        source: this,
                        componentType: block.type,
                    })
                )
            )
            .with({ type: "recirc" }, (block) => {
                const links: DbInsertPostGdocLink[] = []

                block.links.forEach(({ url }, i) => {
                    links.push(
                        createLinkFromUrl({
                            url,
                            source: this,
                            componentType: block.type,
                            text: `Recirc link ${i + 1}`,
                        })
                    )
                })

                return links
            })
            .with({ type: "scroller" }, (block) => {
                const links: DbInsertPostGdocLink[] = []

                block.blocks.forEach(({ url, text }, i) => {
                    const chartLink = createLinkFromUrl({
                        url,
                        source: this,
                        componentType: block.type,
                        text: `Scroller block ${i + 1}`,
                    })
                    links.push(chartLink)
                    text.value.forEach((span) => {
                        traverseEnrichedSpan(span, (span) => {
                            const spanLink = this.extractLinkFromSpan(span)
                            if (spanLink) links.push(spanLink)
                        })
                    })
                })

                return links
            })
            .with({ type: "chart-story" }, (block) => {
                const links: DbInsertPostGdocLink[] = []

                block.items.forEach((storyItem, i) => {
                    const chartLink = createLinkFromUrl({
                        url: storyItem.chart.url,
                        source: this,
                        componentType: block.type,
                        text: `chart-story item ${i + 1}`,
                    })
                    links.push(chartLink)
                    storyItem.narrative.value.forEach((span) =>
                        traverseEnrichedSpan(span, (span) => {
                            const spanLink = this.extractLinkFromSpan(span)
                            if (spanLink) links.push(spanLink)
                        })
                    )
                    storyItem.technical.forEach((textBlock) =>
                        textBlock.value.forEach((span) =>
                            traverseEnrichedSpan(span, (span) => {
                                const spanLink = this.extractLinkFromSpan(span)
                                if (spanLink) links.push(spanLink)
                            })
                        )
                    )
                })

                return links
            })
            .with({ type: "topic-page-intro" }, (block) => {
                const links: DbInsertPostGdocLink[] = []

                if (block.downloadButton) {
                    const downloadButtonLink = createLinkFromUrl({
                        url: block.downloadButton.url,
                        source: this,
                        componentType: block.type,
                        text: block.downloadButton.text,
                    })
                    links.push(downloadButtonLink)
                }
                if (block.relatedTopics) {
                    block.relatedTopics.forEach((relatedTopic) => {
                        const relatedTopicLink = createLinkFromUrl({
                            url: relatedTopic.url,
                            source: this,
                            componentType: block.type,
                            text: relatedTopic.text ?? "",
                        })
                        links.push(relatedTopicLink)
                    })
                }

                block.content.forEach((textBlock) => {
                    textBlock.value.forEach((span) => {
                        traverseEnrichedSpan(span, (span) => {
                            const spanLink = this.extractLinkFromSpan(span)
                            if (spanLink) links.push(spanLink)
                        })
                    })
                })

                return links
            })
            .with({ type: "key-insights" }, (block) => {
                const links: DbInsertPostGdocLink[] = []

                // insights content is traversed by traverseEnrichedBlocks
                block.insights.forEach((insight) => {
                    if (insight.url) {
                        const insightLink = createLinkFromUrl({
                            url: insight.url,
                            source: this,
                            componentType: block.type,
                            text: insight.title,
                        })
                        links.push(insightLink)
                    }
                })

                return links
            })
            .with(
                {
                    type: "explorer-tiles",
                },
                (explorerTiles) =>
                    explorerTiles.explorers.map(({ url }) =>
                        createLinkFromUrl({
                            url,
                            source: this,
                            componentType: "explorer-tiles",
                        })
                    )
            )
            .with(
                {
                    type: "research-and-writing",
                },
                (researchAndWriting) => {
                    const allLinks =
                        getAllLinksFromResearchAndWritingBlock(
                            researchAndWriting
                        )

                    return allLinks.reduce(
                        (links, link) => [
                            ...links,
                            createLinkFromUrl({
                                source: this,
                                url: link.value.url,
                                componentType: researchAndWriting.type,
                                text: link.value.title,
                            }),
                        ],
                        [] as DbInsertPostGdocLink[]
                    )
                }
            )
            .with({ type: "video" }, (video) => {
                return [
                    createLinkFromUrl({
                        url: video.url,
                        source: this,
                        componentType: video.type,
                        text: spansToSimpleString(video.caption || []),
                    }),
                ]
            })
            .with({ type: "key-indicator" }, (block) => {
                return [
                    createLinkFromUrl({
                        url: block.datapageUrl,
                        source: this,
                        componentType: block.type,
                    }),
                ]
            })
            .with({ type: "pill-row" }, (pillRow) => {
                return pillRow.pills.map((pill) =>
                    createLinkFromUrl({
                        url: pill.url,
                        source: this,
                        componentType: pillRow.type,
                        text: pill.text,
                    })
                )
            })
            .with({ type: "homepage-intro" }, (homepageIntro) => {
                return homepageIntro.featuredWork.map((featuredWork) =>
                    createLinkFromUrl({
                        url: featuredWork.url,
                        source: this,
                        componentType: homepageIntro.type,
                        text:
                            featuredWork.title ||
                            featuredWork.description ||
                            "",
                    })
                )
            })
            .with(
                {
                    // no urls directly on any of these blocks
                    // their children may contain urls, but they'll be addressed by traverseEnrichedBlocks
                    type: P.union(
                        "additional-charts",
                        "align",
                        "aside",
                        "blockquote",
                        "callout",
                        "expandable-paragraph",
                        "entry-summary",
                        "gray-section",
                        "heading",
                        "horizontal-rule",
                        "html",
                        "image",
                        "key-indicator-collection",
                        "list",
                        "missing-data",
                        "numbered-list",
                        "pull-quote",
                        "sdg-grid",
                        "sdg-toc",
                        "side-by-side",
                        "simple-text",
                        "sticky-left",
                        "sticky-right",
                        "table",
                        "text",
                        "homepage-search",
                        "latest-data-insights",
                        "socials" // only external links
                    ),
                },
                () => []
            )
            .exhaustive()

        return links
    }

    extractLinkFromSpan(span: Span): DbInsertPostGdocLink | void {
        // Don't track the ref links e.g. "#note-1"
        function checkIsRefAnchor(link: string): boolean {
            return new RegExp(/^#note-\d+$/).test(link)
        }
        if (span.spanType === "span-link") {
            const url = span.url
            if (!checkIsRefAnchor(url)) {
                return createLinkFromUrl({
                    url,
                    source: this,
                    componentType: span.spanType,
                    text: spansToSimpleString(span.children),
                })
            }
        }
    }

    async loadLinkedCharts(knex: db.KnexReadonlyTransaction): Promise<void> {
        const slugToIdMap = await mapSlugsToIds(knex)
        // TODO: rewrite this as a single query instead of N queries
        const linkedGrapherCharts = await Promise.all(
            [...this.linkedChartSlugs.grapher.values()].map(
                async (originalSlug) => {
                    const chartId = slugToIdMap[originalSlug]
                    if (!chartId) return
                    const chart = await getChartConfigById(knex, chartId)
                    if (!chart) return
                    const resolvedSlug = chart.config.slug ?? ""
                    const resolvedTitle = chart.config.title ?? ""
                    const tab = chart.config.tab ?? GrapherTabOption.chart
                    const datapageIndicator =
                        await getVariableOfDatapageIfApplicable(chart.config)
                    const linkedChart: LinkedChart = {
                        originalSlug,
                        title: resolvedTitle,
                        tab,
                        resolvedUrl: `${BAKED_GRAPHER_URL}/${resolvedSlug}`,
                        thumbnail: `${BAKED_GRAPHER_EXPORTS_BASE_URL}/${resolvedSlug}.svg`,
                        tags: [],
                        indicatorId: datapageIndicator?.id,
                    }
                    return linkedChart
                }
            )
        ).then(excludeNullish)

        const publishedExplorersBySlug =
            await db.getPublishedExplorersBySlug(knex)

        const linkedExplorerCharts = excludeNullish(
            this.linkedChartSlugs.explorer.map((originalSlug) => {
                const explorer = publishedExplorersBySlug[originalSlug]
                if (!explorer) return
                const linkedChart: LinkedChart = {
                    // we are assuming explorer slugs won't change
                    originalSlug,
                    title: explorer?.title ?? "",
                    subtitle: explorer?.subtitle ?? "",
                    resolvedUrl: `${BAKED_BASE_URL}/${EXPLORERS_ROUTE_FOLDER}/${originalSlug}`,
                    thumbnail: `${BAKED_BASE_URL}/default-thumbnail.jpg`,
                    tags: explorer.tags,
                }
                return linkedChart
            })
        )

        this.linkedCharts = keyBy(
            [...linkedGrapherCharts, ...linkedExplorerCharts],
            "originalSlug"
        )
    }

    async loadLinkedIndicators(): Promise<void> {
        const linkedIndicators = await Promise.all(
            this.linkedKeyIndicatorSlugs.map(async (originalSlug) => {
                const linkedChart = this.linkedCharts[originalSlug]
                if (!linkedChart || !linkedChart.indicatorId) return
                const metadata = await getVariableMetadata(
                    linkedChart.indicatorId
                )
                const linkedIndicator: LinkedIndicator = {
                    id: linkedChart.indicatorId,
                    ...grabMetadataForGdocLinkedIndicator(metadata, {
                        chartConfigTitle: linkedChart.title,
                    }),
                }
                return linkedIndicator
            })
        ).then(excludeNullish)

        this.linkedIndicators = keyBy(linkedIndicators, "id")
    }

    async loadLinkedDocuments(knex: db.KnexReadonlyTransaction): Promise<void> {
        const linkedDocuments: OwidGdocMinimalPostInterface[] =
            await getMinimalGdocPostsByIds(knex, this.linkedDocumentIds)

        this.linkedDocuments = keyBy(linkedDocuments, "id")
    }

    // TODO: this transaction is only RW because somewhere inside it we fetch images
    async loadImageMetadata(
        knex: db.KnexReadWriteTransaction,
        filenames?: string[]
    ): Promise<void> {
        const imagesFilenames = filenames ?? this.linkedImageFilenames

        if (!imagesFilenames.length) return

        await imageStore.fetchImageMetadata(imagesFilenames)
        const images = await imageStore
            .syncImagesToS3(knex)
            .then(excludeUndefined)

        // Merge the new image metadata with the existing image metadata. This
        // is used by GdocAuthor to load additional image metadata from the
        // latest work section.
        this.imageMetadata = {
            ...this.imageMetadata,
            ...keyBy(images, "filename"),
        }
    }

    async fetchAndEnrichGdoc(): Promise<void> {
        const docsClient = google.docs({
            version: "v1",
            auth: OwidGoogleAuth.getGoogleReadonlyAuth(),
        })

        // Retrieve raw data from Google
        const { data } = await docsClient.documents.get({
            documentId: this.id,
            suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
        })

        this.revisionId = data.revisionId ?? null

        // Convert the doc to ArchieML syntax
        const { text } = await gdocToArchie(data)

        // Convert the ArchieML to our enriched JSON structure
        this.content = archieToEnriched(text, this._enrichSubclassContent)
    }

    async validate(knex: db.KnexReadonlyTransaction): Promise<void> {
        const filenameErrors: OwidGdocErrorMessage[] = this.filenames.reduce(
            (
                errors: OwidGdocErrorMessage[],
                filename
            ): OwidGdocErrorMessage[] => {
                if (!this.imageMetadata[filename]) {
                    errors.push({
                        property: "imageMetadata",
                        message: `No image named ${filename} found in Drive`,
                        type: OwidGdocErrorMessageType.Error,
                    })
                } else if (!this.imageMetadata[filename].defaultAlt) {
                    errors.push({
                        property: "imageMetadata",
                        message: `${filename} is missing a default alt text`,
                        type: OwidGdocErrorMessageType.Error,
                    })
                }
                return errors
            },
            []
        )

        const chartIdsBySlug = await mapSlugsToIds(knex)
        const publishedExplorersBySlug =
            await db.getPublishedExplorersBySlug(knex)

        const linkErrors: OwidGdocErrorMessage[] = this.links.reduce(
            (errors: OwidGdocErrorMessage[], link): OwidGdocErrorMessage[] => {
                if (link.linkType === "gdoc") {
                    const id = getUrlTarget(link.target)
                    const doesGdocExist = Boolean(this.linkedDocuments[id])
                    const isGdocPublished = this.linkedDocuments[id]?.published
                    if (!doesGdocExist || !isGdocPublished) {
                        errors.push({
                            property: "linkedDocuments",
                            message: `${link.componentType} with text "${
                                link.text
                            }" is linking to an ${
                                doesGdocExist ? "unpublished" : "unknown"
                            } gdoc with ID "${link.target}"`,
                            type: OwidGdocErrorMessageType.Warning,
                        })
                    }
                }
                if (link.linkType === "grapher") {
                    if (!chartIdsBySlug[link.target]) {
                        errors.push({
                            property: "content",
                            message: `Grapher chart with slug ${link.target} does not exist or is not published`,
                            type: OwidGdocErrorMessageType.Error,
                        })
                    }
                }

                if (link.linkType === "explorer") {
                    if (!publishedExplorersBySlug[link.target]) {
                        errors.push({
                            property: "content",
                            message: `Explorer chart with slug ${link.target} does not exist or is not published`,
                            type: OwidGdocErrorMessageType.Error,
                        })
                    }
                }
                return errors
            },
            []
        )

        // Validate that charts referenced in key-indicator blocks render a datapage
        const contentErrors: OwidGdocErrorMessage[] = []
        for (const enrichedBlockSource of this.enrichedBlockSources) {
            enrichedBlockSource.forEach((block) =>
                traverseEnrichedBlocks(block, (block) => {
                    if (block.type === "key-indicator" && block.datapageUrl) {
                        const slug = urlToSlug(block.datapageUrl)
                        const linkedChart = this.linkedCharts?.[slug]
                        if (linkedChart && !linkedChart.indicatorId) {
                            contentErrors.push({
                                property: "body",
                                type: OwidGdocErrorMessageType.Error,
                                message: `Grapher chart with slug ${slug} is not a datapage`,
                            })
                        }
                    }
                })
            )
        }

        const subclassErrors = await this._validateSubclass(knex, this)
        this.errors = [
            ...filenameErrors,
            ...linkErrors,
            ...contentErrors,
            ...subclassErrors,
        ]
    }

    // TODO: this transaction is only RW because somewhere inside it we fetch images
    async loadState(knex: db.KnexReadWriteTransaction): Promise<void> {
        await this.loadLinkedDocuments(knex)
        await this.loadImageMetadata(knex)
        await this.loadLinkedCharts(knex)
        await this.loadLinkedIndicators() // depends on linked charts
        await this._loadSubclassAttachments(knex)
        await this.validate(knex)
    }

    toJSON(): OwidGdoc {
        // TODO: this function is currently only used to shrink the object a bit
        // that is used for the isLightningDeploy check (but not, for example, to
        // shrink the object we send over the wire at the /gdoc/:id endpoint).
        // My hunch is that we'll want to clean up the class instance vs objects
        // divergence a bit in the near future - until then this can stay as is.
        return omit(this, [
            "_enrichSubclassContent",
            "_filenameProperties",
            "_getSubclassEnrichedBlocks",
            "_omittableFields",
            "_validateSubclass",
            ...this._omittableFields,
        ]) as any as OwidGdoc
    }
}

// This function would naturally live in GdocFactory but that would create a circular dependency
export async function getMinimalGdocPostsByIds(
    knex: KnexReadonlyTransaction,
    ids: string[]
): Promise<OwidGdocMinimalPostInterface[]> {
    if (ids.length === 0) return []
    const rows = await db.knexRaw<{
        id: string
        title: string
        slug: string
        authors: string
        publishedAt: Date | null
        published: number
        subtitle: string
        excerpt: string
        type: string
        "featured-image": string
    }>(
        knex,
        `-- sql
            SELECT
                id,
                content ->> '$.title' as title,
                slug,
                content ->> '$.authors' as authors,
                publishedAt,
                published,
                content ->> '$.subtitle' as subtitle,
                content ->> '$.excerpt' as excerpt,
                content ->> '$.type' as type,
                content ->> '$."featured-image"' as "featured-image"
            FROM posts_gdocs
            WHERE id in (:ids)`,
        { ids }
    )
    return rows.map((row) => {
        return {
            id: row.id,
            title: row.title,
            slug: row.slug,
            authors: JSON.parse(row.authors) as string[],
            publishedAt: row.publishedAt ? formatDate(row.publishedAt) : null,
            published: !!row.published,
            subtitle: row.subtitle,
            excerpt: row.excerpt,
            type: row.type as OwidGdocType,
            "featured-image": row["featured-image"],
        } satisfies OwidGdocMinimalPostInterface
    })
}
