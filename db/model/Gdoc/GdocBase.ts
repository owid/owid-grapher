import * as db from "../../db.js"
import { getUrlTarget } from "@ourworldindata/components"
import {
    LinkedChart,
    LinkedIndicator,
    keyBy,
    ImageMetadata,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    excludeNullish,
    traverseEnrichedBlock,
    OwidEnrichedGdocBlock,
    Span,
    traverseEnrichedSpan,
    uniq,
    OwidGdocBaseInterface,
    OwidGdocPublicationContext,
    BreadcrumbItem,
    OwidGdocMinimalPostInterface,
    urlToSlug,
    grabMetadataForGdocLinkedIndicator,
    GRAPHER_TAB_OPTIONS,
    DbInsertPostGdocLink,
    DbPlainTag,
    formatDate,
    omit,
} from "@ourworldindata/utils"
import { BAKED_GRAPHER_URL } from "../../../settings/serverSettings.js"
import { google } from "googleapis"
import { gdocToArchie } from "./gdocToArchie.js"
import { archieToEnriched } from "./archieToEnriched.js"
import { getChartConfigById, mapSlugsToIds } from "../Chart.js"
import {
    BAKED_BASE_URL,
    BAKED_GRAPHER_EXPORTS_BASE_URL,
} from "../../../settings/clientSettings.js"
import { EXPLORERS_ROUTE_FOLDER } from "@ourworldindata/explorer"
import { match, P } from "ts-pattern"
import {
    extractFilenamesFromBlock,
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
import {
    getMultiDimDataPageBySlug,
    isMultiDimDataPagePublished,
} from "../MultiDimDataPage.js"
import {
    ARCHVED_THUMBNAIL_FILENAME,
    ChartConfigType,
    DEFAULT_THUMBNAIL_FILENAME,
    GrapherInterface,
    LatestDataInsight,
    LinkedAuthor,
    MultiDimDataPageConfigEnriched,
    OwidGdoc,
    OwidGdocContent,
    OwidGdocLinkType,
    OwidGdocType,
} from "@ourworldindata/types"

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
    donors: string[] = []
    imageMetadata: Record<string, ImageMetadata> = {}
    linkedAuthors: LinkedAuthor[] = []
    linkedCharts: Record<string, LinkedChart> = {}
    linkedIndicators: Record<number, LinkedIndicator> = {}
    linkedDocuments: Record<string, OwidGdocMinimalPostInterface> = {}
    latestDataInsights: LatestDataInsight[] = []
    _omittableFields: string[] = []

    constructor(id?: string) {
        if (id) {
            this.id = id
        }
    }

    /******************************************************************
     * !! Use methods instead of functions as enumerable properties   *
     * (see GdocAuthor.ts for rationale)                              *
     ******************************************************************/

    _getSubclassEnrichedBlocks(_gdoc: typeof this): OwidEnrichedGdocBlock[] {
        return []
    }

    _enrichSubclassContent(_content: Record<string, any>): void {
        return
    }

    async _validateSubclass(
        _knex: db.KnexReadonlyTransaction,
        _gdoc: typeof this
    ): Promise<OwidGdocErrorMessage[]> {
        return []
    }

    async _loadSubclassAttachments(
        _knex: db.KnexReadonlyTransaction
    ): Promise<void> {
        return
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
                traverseEnrichedBlock(block, (block) => {
                    for (const filename of extractFilenamesFromBlock(block)) {
                        filenames.add(filename)
                    }
                })
            )
        }

        return [...filenames]
    }

    get details(): string[] {
        const details: Set<string> = new Set()

        for (const enrichedBlockSource of this.enrichedBlockSources) {
            enrichedBlockSource.forEach((block) =>
                traverseEnrichedBlock(
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

    async loadLinkedAuthors(knex: db.KnexReadonlyTransaction): Promise<void> {
        this.linkedAuthors = await getMinimalAuthorsByNames(
            knex,
            this.content.authors
        )
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
                traverseEnrichedBlock(
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
            .filter((filename) => filename) as string[]
        const featuredAuthorImages = this.linkedAuthors
            .map((author) => author.featuredImage)
            .filter((filename) => !!filename) as string[]

        return [...this.filenames, ...featuredImages, ...featuredAuthorImages]
    }

    get linkedKeyIndicatorSlugs(): string[] {
        const slugs = new Set<string>()
        for (const enrichedBlockSource of this.enrichedBlockSources) {
            for (const block of enrichedBlockSource) {
                traverseEnrichedBlock(block, (block) => {
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
                traverseEnrichedBlock(block, (block) => {
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
            .with({ type: "person" }, (block) => {
                if (!block.url) return []
                return [
                    createLinkFromUrl({
                        url: block.url,
                        source: this,
                        componentType: block.type,
                        text: block.name,
                    }),
                ]
            })
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

                // insights content is traversed by traverseEnrichedBlock
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
                    // their children may contain urls, but they'll be addressed by traverseEnrichedBlock
                    type: P.union(
                        "additional-charts",
                        "align",
                        "aside",
                        "blockquote",
                        "callout",
                        "code",
                        "donors",
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
                        "people",
                        "people-rows",
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
            this.linkedChartSlugs.grapher.map(async (originalSlug) => {
                const chartId = slugToIdMap[originalSlug]
                if (chartId) {
                    const chart = await getChartConfigById(knex, chartId)
                    if (!chart) return
                    return makeGrapherLinkedChart(chart.config, originalSlug)
                } else {
                    const multiDim = await getMultiDimDataPageBySlug(
                        knex,
                        originalSlug
                    )
                    if (!multiDim) return
                    return makeMultiDimLinkedChart(
                        multiDim.config,
                        originalSlug
                    )
                }
            })
        ).then(excludeNullish)

        const publishedExplorersBySlug =
            await db.getPublishedExplorersBySlug(knex)

        const linkedExplorerCharts = excludeNullish(
            this.linkedChartSlugs.explorer.map((originalSlug) => {
                const explorer = publishedExplorersBySlug[originalSlug]
                if (!explorer) return
                return makeExplorerLinkedChart(explorer, originalSlug)
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

    /**
     * Load image metadata from the database.
     */
    async loadImageMetadataFromDB(
        knex: db.KnexReadonlyTransaction,
        filenames?: string[]
    ): Promise<void> {
        const imagesFilenames = filenames ?? this.linkedImageFilenames

        if (!imagesFilenames.length) return

        const imageMetadata = await db.getImageMetadataByFilenames(
            knex,
            imagesFilenames
        )

        this.imageMetadata = {
            ...this.imageMetadata,
            ...keyBy(imageMetadata, "filename"),
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
        const authorErrors = this.content.authors.reduce(
            (errors: OwidGdocErrorMessage[], name): OwidGdocErrorMessage[] => {
                if (!this.linkedAuthors.find((a) => a.name === name)) {
                    errors.push({
                        property: "linkedAuthors",
                        message: `Author "${name}" does not exist or is not published`,
                        type: OwidGdocErrorMessageType.Warning,
                    })
                }
                return errors
            },
            []
        )

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
                        type: OwidGdocErrorMessageType.Warning,
                    })
                }
                return errors
            },
            []
        )

        const chartIdsBySlug = await mapSlugsToIds(knex)
        const publishedExplorersBySlug =
            await db.getPublishedExplorersBySlug(knex)

        const linkErrors: OwidGdocErrorMessage[] = []
        for (const link of this.links) {
            switch (link.linkType) {
                case OwidGdocLinkType.Gdoc: {
                    const id = getUrlTarget(link.target)
                    const doesGdocExist = Boolean(this.linkedDocuments[id])
                    const isGdocPublished = this.linkedDocuments[id]?.published
                    if (!doesGdocExist || !isGdocPublished) {
                        linkErrors.push({
                            property: "linkedDocuments",
                            message: `${link.componentType} with text "${
                                link.text
                            }" is linking to an ${
                                doesGdocExist ? "unpublished" : "unknown"
                            } gdoc with ID "${link.target}"`,
                            type: OwidGdocErrorMessageType.Warning,
                        })
                    }
                    break
                }
                case OwidGdocLinkType.Grapher: {
                    if (
                        !chartIdsBySlug[link.target] &&
                        !(await isMultiDimDataPagePublished(knex, link.target))
                    ) {
                        linkErrors.push({
                            property: "content",
                            message: `Grapher chart with slug ${link.target} does not exist or is not published`,
                            type: OwidGdocErrorMessageType.Error,
                        })
                    }
                    break
                }
                case OwidGdocLinkType.Explorer: {
                    if (!publishedExplorersBySlug[link.target]) {
                        linkErrors.push({
                            property: "content",
                            message: `Explorer chart with slug ${link.target} does not exist or is not published`,
                            type: OwidGdocErrorMessageType.Error,
                        })
                    }
                    break
                }
            }
        }

        // Validate that charts referenced in key-indicator blocks render a datapage
        const contentErrors: OwidGdocErrorMessage[] = []
        for (const enrichedBlockSource of this.enrichedBlockSources) {
            enrichedBlockSource.forEach((block) =>
                traverseEnrichedBlock(block, (block) => {
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
            ...authorErrors,
            ...filenameErrors,
            ...linkErrors,
            ...contentErrors,
            ...subclassErrors,
        ]
    }

    async loadState(knex: db.KnexReadonlyTransaction): Promise<void> {
        await this.loadLinkedAuthors(knex)
        await this.loadLinkedDocuments(knex)
        await this.loadImageMetadataFromDB(knex)
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
            "_loadSubclassAttachments",
            "_omittableFields",
            "_validateSubclass",
            ...this._omittableFields,
        ]) as any as OwidGdoc
    }
}

// This function would naturally live in GdocFactory but that would create a circular dependency
export async function getMinimalGdocPostsByIds(
    knex: db.KnexReadonlyTransaction,
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
                type,
                CASE 
                    WHEN content ->> '$."deprecation-notice"' IS NOT NULL THEN '${ARCHVED_THUMBNAIL_FILENAME}'
                    ELSE content ->> '$."featured-image"'
                END as "featured-image"
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

export async function getMinimalAuthorsByNames(
    knex: db.KnexReadonlyTransaction,
    names: string[]
): Promise<LinkedAuthor[]> {
    if (names.length === 0) return []
    return await db.knexRaw<LinkedAuthor>(
        knex,
        `-- sql
           SELECT
               slug,
               content->>'$.title' AS name,
               content->>'$."featured-image"' AS featuredImage,
               -- updatedAt is often set to the unix epoch instead of null
               COALESCE(NULLIF(updatedAt, '1970-01-01'), createdAt) updatedAt
           FROM posts_gdocs
           WHERE type = 'author'
           AND content->>'$.title' in (:names)
           AND published = 1`,
        { names }
    )
}

export async function makeGrapherLinkedChart(
    config: GrapherInterface,
    originalSlug: string
): Promise<LinkedChart> {
    const resolvedSlug = config.slug ?? ""
    const resolvedTitle = config.title ?? ""
    const resolvedUrl = `${BAKED_GRAPHER_URL}/${resolvedSlug}`
    const tab = config.tab ?? GRAPHER_TAB_OPTIONS.chart
    const datapageIndicator = await getVariableOfDatapageIfApplicable(config)
    return {
        configType: ChartConfigType.Grapher,
        originalSlug,
        title: resolvedTitle,
        tab,
        resolvedUrl,
        thumbnail: `${BAKED_GRAPHER_EXPORTS_BASE_URL}/${resolvedSlug}.svg`,
        tags: [],
        indicatorId: datapageIndicator?.id,
    }
}

export function makeExplorerLinkedChart(
    explorer: {
        slug: string
        title?: string
        subtitle?: string
        thumbnail?: string
        tags?: string[]
    },
    originalSlug: string
): LinkedChart {
    return {
        configType: ChartConfigType.Explorer,
        // we are assuming explorer slugs won't change
        originalSlug,
        title: explorer.title ?? "",
        subtitle: explorer.subtitle ?? "",
        resolvedUrl: `${BAKED_BASE_URL}/${EXPLORERS_ROUTE_FOLDER}/${originalSlug}`,
        thumbnail:
            explorer.thumbnail ||
            `${BAKED_BASE_URL}/${DEFAULT_THUMBNAIL_FILENAME}`,
        tags: explorer.tags ?? [],
    }
}

export function makeMultiDimLinkedChart(
    config: MultiDimDataPageConfigEnriched,
    slug: string
): LinkedChart {
    let title = config.title.title
    const titleVariant = config.title.titleVariant
    if (titleVariant) {
        title = `${title} ${titleVariant}`
    }
    return {
        configType: ChartConfigType.MultiDim,
        originalSlug: slug,
        title,
        resolvedUrl: `${BAKED_GRAPHER_URL}/${slug}`,
        tags: [],
    }
}
