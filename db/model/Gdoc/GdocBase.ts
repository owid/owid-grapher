import {
    Entity,
    Column,
    BaseEntity,
    UpdateDateColumn,
    PrimaryColumn,
    BeforeUpdate,
    BeforeInsert,
    ManyToMany,
    JoinTable,
} from "typeorm"
import { getUrlTarget } from "@ourworldindata/components"
import {
    LinkedChart,
    LinkedIndicator,
    keyBy,
    excludeNull,
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
    omit,
    identity,
    OwidGdocBaseInterface,
    Tag as TagInterface,
    OwidGdocPublicationContext,
    BreadcrumbItem,
    MinimalDataInsightInterface,
    OwidGdocMinimalPostInterface,
    urlToSlug,
    grabMetadataForGdocLinkedIndicator,
} from "@ourworldindata/utils"
import { BAKED_GRAPHER_URL } from "../../../settings/serverSettings.js"
import { google } from "googleapis"
import { gdocToArchie } from "./gdocToArchie.js"
import { archieToEnriched } from "./archieToEnriched.js"
import { Link } from "../Link.js"
import { imageStore } from "../Image.js"
import { Chart } from "../Chart.js"
import {
    BAKED_BASE_URL,
    BAKED_GRAPHER_EXPORTS_BASE_URL,
} from "../../../settings/clientSettings.js"
import { EXPLORERS_ROUTE_FOLDER } from "../../../explorer/ExplorerConstants.js"
import { match, P } from "ts-pattern"
import {
    extractUrl,
    fullGdocToMinimalGdoc,
    getAllLinksFromResearchAndWritingBlock,
    spansToSimpleString,
} from "./gdocUtils.js"
import { OwidGoogleAuth } from "../../OwidGoogleAuth.js"
import { enrichedBlocksToMarkdown } from "./enrichedToMarkdown.js"
import {
    getVariableMetadata,
    getVariableOfDatapageIfApplicable,
} from "../Variable.js"

@Entity("tags")
export class Tag extends BaseEntity implements TagInterface {
    static table = "tags"
    @PrimaryColumn() id!: number
    @Column() name!: string
    @Column() createdAt!: Date
    @Column({ nullable: true }) updatedAt!: Date
    @Column({ nullable: true }) parentId!: number
    @Column() isBulkImport!: boolean
    @Column({ type: "varchar", nullable: true }) slug!: string | null
    @Column() specialType!: string
    @ManyToMany(() => GdocBase, (gdoc) => gdoc.tags)
    gdocs!: GdocBase[]
}

@Entity("posts_gdocs")
export class GdocBase extends BaseEntity implements OwidGdocBaseInterface {
    @PrimaryColumn() id!: string
    @Column() slug: string = ""
    @Column({ default: "{}", type: "json" }) content!: Record<string, any>
    @Column() published: boolean = false
    @Column() createdAt: Date = new Date()
    @Column({ type: Date, nullable: true }) publishedAt: Date | null = null
    @UpdateDateColumn({ nullable: true }) updatedAt: Date | null = null
    @Column({ type: String, nullable: true }) revisionId: string | null = null
    @Column({ type: String, nullable: true }) markdown: string | null = null
    @Column() publicationContext: OwidGdocPublicationContext =
        OwidGdocPublicationContext.unlisted
    @Column({ type: "json", nullable: true }) breadcrumbs:
        | BreadcrumbItem[]
        | null = null
    @ManyToMany(() => Tag, { cascade: true })
    @JoinTable({
        name: "posts_gdocs_x_tags",
        joinColumn: { name: "gdocId", referencedColumnName: "id" },
        inverseJoinColumn: { name: "tagId", referencedColumnName: "id" },
    })
    tags!: Tag[]

    errors: OwidGdocErrorMessage[] = []
    imageMetadata: Record<string, ImageMetadata> = {}
    linkedCharts: Record<string, LinkedChart> = {}
    linkedIndicators: Record<number, LinkedIndicator> = {}
    linkedDocuments: Record<string, OwidGdocMinimalPostInterface> = {}
    latestDataInsights: MinimalDataInsightInterface[] = []

    _getSubclassEnrichedBlocks: (gdoc: typeof this) => OwidEnrichedGdocBlock[] =
        () => []
    _enrichSubclassContent: (content: Record<string, any>) => void = identity
    _validateSubclass: (gdoc: typeof this) => Promise<OwidGdocErrorMessage[]> =
        async () => []
    // Some subclasses have filenames/urls in the front-matter that we want to track
    _filenameProperties: string[] = []
    _urlProperties: string[] = []
    _omittableFields: string[] = []
    _loadSubclassAttachments: () => Promise<void> = async () => undefined

    constructor(id?: string) {
        super()
        if (id) {
            this.id = id
        }
        this.content = {}
    }

    get enrichedBlockSources(): OwidEnrichedGdocBlock[][] {
        const enrichedBlockSources: OwidEnrichedGdocBlock[][] = excludeNullish([
            this.content.body,
            this._getSubclassEnrichedBlocks(this),
        ])

        return enrichedBlockSources
    }

    @BeforeUpdate()
    @BeforeInsert()
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

        for (const filenameProperty of this._filenameProperties) {
            const filename = this.content[filenameProperty]
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

    get links(): Link[] {
        const links: Link[] = []

        for (const urlProperty of this._urlProperties) {
            const url = extractUrl(this.content[urlProperty])
            if (url) {
                links.push(
                    Link.createFromUrl({
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

    extractLinksFromBlock(block: OwidEnrichedGdocBlock): Link[] | void {
        const links: Link[] = match(block)
            .with({ type: "prominent-link" }, (block) => [
                Link.createFromUrl({
                    url: block.url,
                    source: this,
                    componentType: block.type,
                    text: block.title,
                }),
            ])
            .with({ type: "chart" }, (block) => [
                Link.createFromUrl({
                    url: block.url,
                    source: this,
                    componentType: block.type,
                }),
            ])
            .with({ type: "all-charts" }, (block) =>
                block.top.map((item) =>
                    Link.createFromUrl({
                        url: item.url,
                        source: this,
                        componentType: block.type,
                    })
                )
            )
            .with({ type: "recirc" }, (block) => {
                const links: Link[] = []

                block.links.forEach(({ url }, i) => {
                    links.push(
                        Link.createFromUrl({
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
                const links: Link[] = []

                block.blocks.forEach(({ url, text }, i) => {
                    const chartLink = Link.createFromUrl({
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
                const links: Link[] = []

                block.items.forEach((storyItem, i) => {
                    const chartLink = Link.createFromUrl({
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
                const links: Link[] = []

                if (block.downloadButton) {
                    const downloadButtonLink = Link.createFromUrl({
                        url: block.downloadButton.url,
                        source: this,
                        componentType: block.type,
                        text: block.downloadButton.text,
                    })
                    links.push(downloadButtonLink)
                }
                if (block.relatedTopics) {
                    block.relatedTopics.forEach((relatedTopic) => {
                        const relatedTopicLink = Link.createFromUrl({
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
                const links: Link[] = []

                // insights content is traversed by traverseEnrichedBlocks
                block.insights.forEach((insight) => {
                    if (insight.url) {
                        const insightLink = Link.createFromUrl({
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
                            Link.createFromUrl({
                                source: this,
                                url: link.value.url,
                                componentType: researchAndWriting.type,
                                text: link.value.title,
                            }),
                        ],
                        [] as Link[]
                    )
                }
            )
            .with({ type: "video" }, (video) => {
                return [
                    Link.createFromUrl({
                        url: video.url,
                        source: this,
                        componentType: video.type,
                        text: spansToSimpleString(video.caption || []),
                    }),
                ]
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
                        "key-indicator",
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
                        "text"
                    ),
                },
                () => []
            )
            .exhaustive()

        return links
    }

    extractLinkFromSpan(span: Span): Link | void {
        // Don't track the ref links e.g. "#note-1"
        function checkIsRefAnchor(link: string): boolean {
            return new RegExp(/^#note-\d+$/).test(link)
        }
        if (span.spanType === "span-link") {
            const url = span.url
            if (!checkIsRefAnchor(url)) {
                return Link.createFromUrl({
                    url,
                    source: this,
                    componentType: span.spanType,
                    text: spansToSimpleString(span.children),
                })
            }
        }
    }

    async loadLinkedCharts(
        publishedExplorersBySlug: Record<string, any>
    ): Promise<void> {
        const slugToIdMap = await Chart.mapSlugsToIds()
        const linkedGrapherCharts = await Promise.all(
            [...this.linkedChartSlugs.grapher.values()].map(
                async (originalSlug) => {
                    const chartId = slugToIdMap[originalSlug]
                    if (!chartId) return
                    const chart = await Chart.findOneBy({ id: chartId })
                    if (!chart) return
                    const resolvedSlug = chart.config.slug ?? ""
                    const resolvedTitle = chart.config.title ?? ""
                    const datapageIndicator =
                        await getVariableOfDatapageIfApplicable(chart.config)
                    const linkedChart: LinkedChart = {
                        originalSlug,
                        title: resolvedTitle,
                        resolvedUrl: `${BAKED_GRAPHER_URL}/${resolvedSlug}`,
                        thumbnail: `${BAKED_GRAPHER_EXPORTS_BASE_URL}/${resolvedSlug}.svg`,
                        indicatorId: datapageIndicator?.id,
                    }
                    return linkedChart
                }
            )
        ).then(excludeNullish)

        const linkedExplorerCharts = await Promise.all(
            [...this.linkedChartSlugs.explorer.values()].map((originalSlug) => {
                const explorer = publishedExplorersBySlug[originalSlug]
                if (!explorer) return
                const linkedChart: LinkedChart = {
                    // we are assuming explorer slugs won't change
                    originalSlug,
                    title: explorer?.explorerTitle ?? "",
                    resolvedUrl: `${BAKED_BASE_URL}/${EXPLORERS_ROUTE_FOLDER}/${originalSlug}`,
                    thumbnail: `${BAKED_BASE_URL}/default-thumbnail.jpg`,
                }
                return linkedChart
            })
        ).then(excludeNullish)

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
                    ...grabMetadataForGdocLinkedIndicator(metadata),
                }
                return linkedIndicator
            })
        ).then(excludeNullish)

        this.linkedIndicators = keyBy(linkedIndicators, "id")
    }

    async loadLinkedDocuments(): Promise<void> {
        const linkedDocuments: OwidGdocMinimalPostInterface[] =
            await Promise.all(
                this.linkedDocumentIds.map(async (target) => {
                    const linkedDocument = await GdocBase.findOneBy({
                        id: target,
                    })
                    return linkedDocument
                })
            )
                .then(excludeNull)
                .then((fullGdocs) => fullGdocs.map(fullGdocToMinimalGdoc))

        this.linkedDocuments = keyBy(linkedDocuments, "id")
    }

    async loadImageMetadata(): Promise<void> {
        if (this.linkedImageFilenames.length) {
            await imageStore.fetchImageMetadata(this.linkedImageFilenames)
            const images = await imageStore
                .syncImagesToS3()
                .then(excludeUndefined)
            this.imageMetadata = keyBy(images, "filename")
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

    async validate(
        publishedExplorersBySlug: Record<string, any>
    ): Promise<void> {
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

        const chartIdsBySlug = await Chart.mapSlugsToIds()

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

        const subclassErrors = await this._validateSubclass(this)
        this.errors = [
            ...filenameErrors,
            ...linkErrors,
            ...contentErrors,
            ...subclassErrors,
        ]
    }

    async loadState(
        publishedExplorersBySlug: Record<string, any>
    ): Promise<void> {
        await this.loadLinkedDocuments()
        await this.loadImageMetadata()
        await this.loadLinkedCharts(publishedExplorersBySlug)
        await this.loadLinkedIndicators() // depends on linked charts
        await this._loadSubclassAttachments()
        await this.validate(publishedExplorersBySlug)
    }

    toJSON<T extends OwidGdocBaseInterface>(): T {
        return omit(this, [
            "_enrichSubclassContent",
            "_filenameProperties",
            "_getSubclassEnrichedBlocks",
            "_omittableFields",
            "_validateSubclass",
            ...this._omittableFields,
        ]) as any as T
    }
}
