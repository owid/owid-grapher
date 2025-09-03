import * as _ from "lodash-es"
import * as db from "../../db.js"
import { getUrlTarget, MarkdownTextWrap } from "@ourworldindata/components"
import {
    LinkedChart,
    LinkedIndicator,
    ImageMetadata,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    excludeNullish,
    traverseEnrichedBlock,
    OwidEnrichedGdocBlock,
    Span,
    traverseEnrichedSpan,
    OwidGdocBaseInterface,
    OwidGdocPublicationContext,
    BreadcrumbItem,
    OwidGdocMinimalPostInterface,
    urlToSlug,
    GRAPHER_TAB_CONFIG_OPTIONS,
    GRAPHER_QUERY_PARAM_KEYS,
    DbInsertPostGdocLink,
    DbPlainTag,
    formatDate,
    excludeUndefined,
    Url,
} from "@ourworldindata/utils"
import { BAKED_GRAPHER_URL } from "../../../settings/serverSettings.js"
import { docs as googleDocs } from "@googleapis/docs"
import { gdocToArchie } from "./gdocToArchie.js"
import { archieToEnriched } from "./archieToEnriched.js"
import { getChartConfigById, mapSlugsToIds } from "../Chart.js"
import {
    BAKED_BASE_URL,
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
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
import { getDatapageIndicatorId } from "../Variable.js"
import { createLinkForNarrativeChart, createLinkFromUrl } from "../Link.js"
import {
    getMultiDimDataPageBySlug,
    multiDimDataPageExists,
} from "../MultiDimDataPage.js"
import {
    ARCHVED_THUMBNAIL_FILENAME,
    ChartConfigType,
    NarrativeChartInfo,
    ContentGraphLinkType,
    DEFAULT_THUMBNAIL_FILENAME,
    GrapherInterface,
    LatestDataInsight,
    LinkedAuthor,
    MultiDimDataPageConfigEnriched,
    OwidGdoc,
    OwidGdocContent,
    OwidGdocType,
    DbRawVariable,
    VariablesTableName,
    parseVariableDisplayConfig,
    joinTitleFragments,
    ArchivedPageVersion,
} from "@ourworldindata/types"
import {
    getAllNarrativeChartNames,
    getNarrativeChartsInfo,
} from "../NarrativeChart.js"
import { indexBy } from "remeda"
import { getDods } from "../Dod.js"
import {
    getLatestChartArchivedVersionsIfEnabled,
    getLatestMultiDimArchivedVersionsIfEnabled,
} from "../archival/archivalDb.js"

export async function getLinkedIndicatorsForCharts(
    knex: db.KnexReadonlyTransaction,
    indicatorsWithTitles: Array<{ indicatorId: number; chartTitle: string }>
): Promise<LinkedIndicator[]> {
    if (indicatorsWithTitles.length === 0) return []
    const indicatorIds = indicatorsWithTitles.map((item) => item.indicatorId)
    const rows = await knex<DbRawVariable>(VariablesTableName)
        .select(
            "id",
            "name",
            "display",
            "titlePublic",
            "attributionShort",
            "titleVariant"
        )
        .whereIn("id", indicatorIds)
    const metadataById = new Map(rows.map((row) => [row.id, row]))
    return indicatorsWithTitles.map(({ indicatorId, chartTitle }) => {
        const row = metadataById.get(indicatorId)
        if (!row) {
            throw new Error(`Variable with id ${indicatorId} not found`)
        }
        const display = parseVariableDisplayConfig(row.display)
        const title =
            row.titlePublic || chartTitle || display?.name || row.name || ""
        const attributionShort = joinTitleFragments(
            row.attributionShort ?? undefined,
            row.titleVariant ?? undefined
        )
        return { id: indicatorId, title, attributionShort }
    })
}

export class GdocBase implements OwidGdocBaseInterface {
    id!: string
    slug: string = ""
    declare content: OwidGdocContent
    published: boolean = false
    createdAt: Date = new Date()
    publishedAt: Date | null = null
    updatedAt: Date | null = null
    revisionId: string | null = null
    markdown: string | null = null
    publicationContext: OwidGdocPublicationContext =
        OwidGdocPublicationContext.unlisted
    breadcrumbs: BreadcrumbItem[] | null = null
    manualBreadcrumbs: BreadcrumbItem[] | null = null
    tags: DbPlainTag[] | null = null
    errors: OwidGdocErrorMessage[] = []
    donors: string[] = []
    imageMetadata: Record<string, ImageMetadata> = {}
    linkedAuthors: LinkedAuthor[] = []
    linkedCharts: Record<string, LinkedChart> = {}
    linkedIndicators: Record<number, LinkedIndicator> = {}
    linkedDocuments: Record<string, OwidGdocMinimalPostInterface> = {}
    latestDataInsights: LatestDataInsight[] = []
    linkedNarrativeCharts?: Record<string, NarrativeChartInfo> = {}
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
                        sourceId: this.id,
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
        return _.uniq(
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

    get linkedNarrativeChartNames(): string[] {
        const filteredLinks = this.links
            .filter(
                (link) => link.linkType === ContentGraphLinkType.NarrativeChart
            )
            .map((link) => link.target)

        return filteredLinks
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
            .with({ type: "image" }, (block) => {
                const links: DbInsertPostGdocLink[] = []
                if (!block.caption) return links
                for (const span of block.caption) {
                    traverseEnrichedSpan(span, (span) => {
                        const link = this.extractLinkFromSpan(span)
                        if (link) links.push(link)
                    })
                }
                return links
            })
            .with({ type: "person" }, (block) => {
                if (!block.url) return []
                return [
                    createLinkFromUrl({
                        url: block.url,
                        sourceId: this.id,
                        componentType: block.type,
                        text: block.name,
                    }),
                ]
            })
            .with({ type: "prominent-link" }, (block) => [
                createLinkFromUrl({
                    url: block.url,
                    sourceId: this.id,
                    componentType: block.type,
                    text: block.title,
                }),
            ])
            .with({ type: "chart" }, (block) => [
                createLinkFromUrl({
                    url: block.url,
                    sourceId: this.id,
                    componentType: block.type,
                }),
            ])
            .with({ type: "narrative-chart" }, (block) => [
                createLinkForNarrativeChart({
                    name: block.name,
                    sourceId: this.id,
                    componentType: block.type,
                }),
            ])
            .with({ type: "all-charts" }, (block) =>
                block.top.map((item) =>
                    createLinkFromUrl({
                        url: item.url,
                        sourceId: this.id,
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
                            sourceId: this.id,
                            componentType: block.type,
                            text: `Recirc link ${i + 1}`,
                        })
                    )
                })

                return links
            })
            .with({ type: "resource-panel" }, (block) => {
                const links: DbInsertPostGdocLink[] = []

                block.links.forEach(({ url }, i) => {
                    links.push(
                        createLinkFromUrl({
                            url,
                            sourceId: this.id,
                            componentType: block.type,
                            text: `Resource panel link ${i + 1}`,
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
                        sourceId: this.id,
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
            .with({ type: "cta" }, (block) => [
                createLinkFromUrl({
                    url: block.url,
                    sourceId: this.id,
                    componentType: block.type,
                    text: block.text,
                }),
            ])
            .with({ type: "chart-story" }, (block) => {
                const links: DbInsertPostGdocLink[] = []

                block.items.forEach((storyItem, i) => {
                    const chartLink = createLinkFromUrl({
                        url: storyItem.chart.url,
                        sourceId: this.id,
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
                        sourceId: this.id,
                        componentType: block.type,
                        text: block.downloadButton.text,
                    })
                    links.push(downloadButtonLink)
                }
                if (block.relatedTopics) {
                    block.relatedTopics.forEach((relatedTopic) => {
                        const relatedTopicLink = createLinkFromUrl({
                            url: relatedTopic.url,
                            sourceId: this.id,
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
                            sourceId: this.id,
                            componentType: block.type,
                            text: insight.title,
                        })
                        links.push(insightLink)
                    } else if (insight.narrativeChartName) {
                        const insightLink = createLinkForNarrativeChart({
                            name: insight.narrativeChartName,
                            sourceId: this.id,
                            componentType: block.type,
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
                            sourceId: this.id,
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
                                sourceId: this.id,
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
                        sourceId: this.id,
                        componentType: video.type,
                        text: spansToSimpleString(video.caption || []),
                    }),
                ]
            })
            .with({ type: "key-indicator" }, (block) => {
                return [
                    createLinkFromUrl({
                        url: block.datapageUrl,
                        sourceId: this.id,
                        componentType: block.type,
                    }),
                ]
            })
            .with({ type: "pill-row" }, (pillRow) => {
                return pillRow.pills.map((pill) =>
                    createLinkFromUrl({
                        url: pill.url,
                        sourceId: this.id,
                        componentType: pillRow.type,
                        text: pill.text,
                    })
                )
            })
            .with({ type: "homepage-intro" }, (homepageIntro) => {
                return homepageIntro.featuredWork.map((featuredWork) =>
                    createLinkFromUrl({
                        url: featuredWork.url,
                        sourceId: this.id,
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
                        "cookie-notice",
                        "donors",
                        "expandable-paragraph",
                        "expander",
                        "entry-summary",
                        "gray-section",
                        "heading",
                        "horizontal-rule",
                        "html",
                        "key-indicator-collection",
                        "list",
                        "missing-data",
                        "numbered-list",
                        "people",
                        "people-rows",
                        "pull-quote",
                        "guided-chart",
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
                    sourceId: this.id,
                    componentType: span.spanType,
                    text: spansToSimpleString(span.children),
                })
            }
        }
        if (span.spanType === "span-dod") {
            return {
                target: span.id,
                sourceId: this.id,
                componentType: span.spanType,
                hash: "",
                queryString: "",
                text: spansToSimpleString(span.children),
                linkType: ContentGraphLinkType.Dod,
            } satisfies DbInsertPostGdocLink
        }
        if (span.spanType === "span-guided-chart-link") {
            return {
                target: span.url,
                sourceId: this.id,
                componentType: span.spanType,
                hash: "",
                queryString: "",
                text: spansToSimpleString(span.children),
                linkType: ContentGraphLinkType.GuidedChart,
            }
        }
    }

    async loadLinkedCharts(knex: db.KnexReadonlyTransaction): Promise<void> {
        const slugToIdMap = await mapSlugsToIds(knex)

        const [archivedChartVersions, archivedMultiDimVersions] =
            await Promise.all([
                getLatestChartArchivedVersionsIfEnabled(
                    knex,
                    excludeUndefined(
                        this.linkedChartSlugs.grapher.map(
                            (slug) => slugToIdMap[slug]
                        )
                    )
                ),
                getLatestMultiDimArchivedVersionsIfEnabled(knex),
            ])

        // TODO: rewrite this as a single query instead of N queries
        const linkedGrapherCharts = await Promise.all(
            this.linkedChartSlugs.grapher.map(async (originalSlug) => {
                const chartId = slugToIdMap[originalSlug]
                if (chartId) {
                    const chart = await getChartConfigById(knex, chartId)
                    if (!chart) return

                    return makeGrapherLinkedChart(
                        knex,
                        chart.config,
                        originalSlug,
                        {
                            archivedChartInfo:
                                archivedChartVersions[chartId] || undefined,
                        }
                    )
                } else {
                    const multiDim = await getMultiDimDataPageBySlug(
                        knex,
                        originalSlug,
                        { onlyPublished: false }
                    )
                    if (!multiDim) return

                    return makeMultiDimLinkedChart(
                        multiDim.config,
                        originalSlug,
                        {
                            archivedChartInfo:
                                archivedMultiDimVersions[multiDim.id] ||
                                undefined,
                        }
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

        this.linkedCharts = _.keyBy(
            [...linkedGrapherCharts, ...linkedExplorerCharts],
            "originalSlug"
        )
    }

    async loadLinkedIndicators(
        knex: db.KnexReadonlyTransaction
    ): Promise<void> {
        const indicatorsWithTitles = []
        for (const originalSlug of this.linkedKeyIndicatorSlugs) {
            const linkedChart = this.linkedCharts[originalSlug]
            if (!linkedChart?.indicatorId) continue
            indicatorsWithTitles.push({
                indicatorId: linkedChart.indicatorId,
                chartTitle: linkedChart.title,
            })
        }

        const linkedIndicators = await getLinkedIndicatorsForCharts(
            knex,
            indicatorsWithTitles
        )

        this.linkedIndicators = _.keyBy(linkedIndicators, "id")
    }

    async loadLinkedDocuments(knex: db.KnexReadonlyTransaction): Promise<void> {
        const linkedDocuments: OwidGdocMinimalPostInterface[] =
            await getMinimalGdocPostsByIds(knex, this.linkedDocumentIds)

        this.linkedDocuments = _.keyBy(linkedDocuments, "id")
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
            ..._.keyBy(imageMetadata, "filename"),
        }
    }

    async loadNarrativeChartsInfo(
        knex: db.KnexReadonlyTransaction
    ): Promise<void> {
        const result = await getNarrativeChartsInfo(
            knex,
            this.linkedNarrativeChartNames
        )
        this.linkedNarrativeCharts = _.keyBy(result, "name")
    }

    async fetchAndEnrichGdoc(): Promise<void> {
        const docsClient = googleDocs({
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
        const whitespaceErrors: OwidGdocErrorMessage[] = []
        const documentContainsInvalidWhitespace = this.content
            ? // match on actual whitespace or the literal string '\u000b'
              /[\v\t\r]|\\u000b/g.test(JSON.stringify(this.content))
            : false

        if (documentContainsInvalidWhitespace) {
            whitespaceErrors.push({
                property: "body",
                message:
                    "The gdoc contains invalid whitespace characters. To find them, try searching the gdoc for '[\\v\\t\\r\\u000b]' in the 'Find and replace' menu with the 'Use regular expressions' option enabled. Replace them with newlines (i.e. backspace them then press the enter key) or spaces.",
                type: OwidGdocErrorMessageType.Error,
            })
        }

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
                        message: `No image named ${filename} found in the admin`,
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

        const [
            chartIdsBySlug,
            publishedExplorersBySlug,
            narrativeChartNames,
            dods,
        ] = await Promise.all([
            mapSlugsToIds(knex),
            db.getPublishedExplorersBySlug(knex),
            getAllNarrativeChartNames(knex),
            getDods(knex).then((dods) => indexBy(dods, (dod) => dod.name)),
        ])

        const linkErrors: OwidGdocErrorMessage[] = []
        for (const link of this.links) {
            await match(link)
                .with({ linkType: ContentGraphLinkType.Gdoc }, () => {
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
                })
                .with({ linkType: ContentGraphLinkType.Grapher }, async () => {
                    if (
                        !chartIdsBySlug[link.target] &&
                        !(await multiDimDataPageExists(knex, {
                            slug: link.target,
                            published: true,
                        }))
                    ) {
                        linkErrors.push({
                            property: "content",
                            message: `Grapher chart with slug ${link.target} does not exist or is not published`,
                            type: OwidGdocErrorMessageType.Error,
                        })
                    }
                })
                .with({ linkType: ContentGraphLinkType.Explorer }, () => {
                    if (!publishedExplorersBySlug[link.target]) {
                        linkErrors.push({
                            property: "content",
                            message: `Explorer chart with slug ${link.target} does not exist or is not published`,
                            type: OwidGdocErrorMessageType.Error,
                        })
                    }
                })
                .with({ linkType: ContentGraphLinkType.NarrativeChart }, () => {
                    if (!narrativeChartNames.has(link.target)) {
                        linkErrors.push({
                            property: "content",
                            message: `Narrative chart with name ${link.target} does not exist`,
                            type: OwidGdocErrorMessageType.Error,
                        })
                    }
                })
                .with({ linkType: ContentGraphLinkType.Dod }, () => {
                    const id = getUrlTarget(link.target)
                    const doesDodExist = Boolean(dods[id])
                    if (!doesDodExist) {
                        linkErrors.push({
                            property: "linkedDocuments",
                            message: `Link with text "${link.text}" is referencing an unknown dod with name "${link.target}"`,
                            type: OwidGdocErrorMessageType.Error,
                        })
                    }
                })
                .with({ linkType: ContentGraphLinkType.GuidedChart }, () => {
                    // Validate that guided chart query parameters are spelled correctly
                    const url = Url.fromURL(link.target)
                    const slug = url.slug
                    const queryParams = url.queryParams
                    const chart = slug ? this.linkedCharts[slug] : undefined
                    if (!chart) {
                        linkErrors.push({
                            property: "content",
                            message: `Chart with slug "${slug}" does not exist`,
                            type: OwidGdocErrorMessageType.Error,
                        })
                        return
                    }
                    for (const key of Object.keys(queryParams)) {
                        if (
                            key &&
                            !GRAPHER_QUERY_PARAM_KEYS.includes(key as any) &&
                            !chart.dimensionSlugs?.includes(key)
                        ) {
                            linkErrors.push({
                                property: "content",
                                message: `Guided chart link with text "${link.text}" contains invalid query parameter "${key}".`,
                                type: OwidGdocErrorMessageType.Warning,
                            })
                        }
                    }
                })
                .with(
                    {
                        linkType: P.union(
                            ContentGraphLinkType.Url,
                            undefined,
                            null
                        ),
                    },
                    () => {
                        return
                    }
                )
                .exhaustive()
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
            ...whitespaceErrors,
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
        await this.loadLinkedIndicators(knex) // depends on linked charts
        await this.loadNarrativeChartsInfo(knex)
        await this._loadSubclassAttachments(knex)
        await this.validate(knex)
    }

    toJSON(): OwidGdoc {
        // TODO: this function is currently only used to shrink the object a bit
        // that is used for the isLightningDeploy check (but not, for example, to
        // shrink the object we send over the wire at the /gdoc/:id endpoint).
        // My hunch is that we'll want to clean up the class instance vs objects
        // divergence a bit in the near future - until then this can stay as is.
        return _.omit(this, [
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
                authors,
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
    knex: db.KnexReadonlyTransaction,
    config: GrapherInterface,
    originalSlug: string,
    { archivedChartInfo }: { archivedChartInfo?: ArchivedPageVersion } = {}
): Promise<LinkedChart> {
    const resolvedSlug = config.slug ?? ""
    const resolvedTitle = config.title ?? ""
    const subtitle = new MarkdownTextWrap({
        text: config.subtitle || "",
        fontSize: 12,
    }).plaintext
    const resolvedUrl = `${BAKED_GRAPHER_URL}/${resolvedSlug}`
    const tab = config.tab ?? GRAPHER_TAB_CONFIG_OPTIONS.chart
    const indicatorId = await getDatapageIndicatorId(knex, config)
    return {
        configType: ChartConfigType.Grapher,
        originalSlug,
        title: resolvedTitle,
        subtitle,
        tab,
        resolvedUrl,
        thumbnail: `${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${resolvedSlug}.png`,
        tags: [],
        indicatorId,
        archivedChartInfo,
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
    slug: string,
    { archivedChartInfo }: { archivedChartInfo?: ArchivedPageVersion } = {}
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
        dimensionSlugs: config.dimensions.map((d) => d.slug),
        resolvedUrl: `${BAKED_GRAPHER_URL}/${slug}`,
        tags: [],
        archivedChartInfo,
    }
}
