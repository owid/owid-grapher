import {
    Entity,
    Column,
    BaseEntity,
    UpdateDateColumn,
    PrimaryColumn,
    ManyToMany,
    JoinTable,
    LessThanOrEqual,
} from "typeorm"
import { getUrlTarget } from "@ourworldindata/components"
import {
    Tag as TagInterface,
    LinkedChart,
    type OwidGdocContent,
    OwidGdocInterface,
    OwidGdocPublished,
    OwidGdocPublicationContext,
    GdocsContentSource,
    JsonError,
    keyBy,
    excludeNull,
    ImageMetadata,
    excludeUndefined,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    excludeNullish,
    DetailDictionary,
    ParseError,
    OwidGdocType,
    traverseEnrichedBlocks,
    OwidEnrichedGdocBlock,
    Span,
    EnrichedBlockResearchAndWritingLink,
    traverseEnrichedSpan,
    RelatedChart,
    BreadcrumbItem,
    uniq,
} from "@ourworldindata/utils"
import {
    BAKED_GRAPHER_URL,
    GDOCS_CLIENT_EMAIL,
    GDOCS_CLIENT_ID,
    GDOCS_DETAILS_ON_DEMAND_ID,
    GDOCS_PRIVATE_KEY,
} from "../../../settings/serverSettings.js"
import { google, Auth, docs_v1 } from "googleapis"
import { gdocToArchie } from "./gdocToArchie.js"
import { archieToEnriched } from "./archieToEnriched.js"
import { Link } from "../Link.js"
import { imageStore } from "../Image.js"
import { Chart } from "../Chart.js"
import {
    ADMIN_BASE_URL,
    BAKED_BASE_URL,
    BAKED_GRAPHER_EXPORTS_BASE_URL,
} from "../../../settings/clientSettings.js"
import { EXPLORERS_ROUTE_FOLDER } from "../../../explorer/ExplorerConstants.js"
import { parseDetails, parseFaqs } from "./rawToEnriched.js"
import { match, P } from "ts-pattern"
import {
    getAllLinksFromResearchAndWritingBlock,
    spansToSimpleString,
} from "./gdocUtils.js"
import { getConnection } from "../../db.js"

@Entity("tags")
export class Tag extends BaseEntity implements TagInterface {
    static table = "tags"
    @PrimaryColumn() id!: number
    @Column() name!: string
    @Column() createdAt!: Date
    @Column({ nullable: true }) updatedAt!: Date
    @Column({ nullable: true }) parentId!: number
    @Column() isBulkImport!: boolean
    @Column() isTopic!: boolean
    @Column() specialType!: string
    @ManyToMany(() => Gdoc, (gdoc) => gdoc.tags)
    gdocs!: Gdoc[]
}

export class OwidGoogleAuth {
    static cachedGoogleReadonlyAuth?: Auth.GoogleAuth
    static cachedGoogleReadWriteAuth?: Auth.GoogleAuth
    static cachedGoogleClient?: docs_v1.Docs

    static areGdocAuthKeysSet(): boolean {
        return !!(GDOCS_PRIVATE_KEY && GDOCS_CLIENT_EMAIL && GDOCS_CLIENT_ID)
    }

    static getGoogleReadWriteAuth(): Auth.GoogleAuth {
        if (!OwidGoogleAuth.cachedGoogleReadWriteAuth) {
            OwidGoogleAuth.cachedGoogleReadWriteAuth =
                new google.auth.GoogleAuth({
                    credentials: {
                        type: "service_account",
                        private_key: GDOCS_PRIVATE_KEY.split("\\n").join("\n"),
                        client_email: GDOCS_CLIENT_EMAIL,
                        client_id: GDOCS_CLIENT_ID,
                    },
                    scopes: [
                        "https://www.googleapis.com/auth/documents",
                        "https://www.googleapis.com/auth/drive.file",
                    ],
                })
        }
        return OwidGoogleAuth.cachedGoogleReadWriteAuth
    }

    static getGoogleReadonlyAuth(): Auth.GoogleAuth {
        if (!OwidGoogleAuth.cachedGoogleReadonlyAuth) {
            OwidGoogleAuth.cachedGoogleReadonlyAuth =
                new google.auth.GoogleAuth({
                    credentials: {
                        type: "service_account",
                        private_key: GDOCS_PRIVATE_KEY.split("\\n").join("\n"),
                        client_email: GDOCS_CLIENT_EMAIL,
                        client_id: GDOCS_CLIENT_ID,
                    },
                    // Scopes can be specified either as an array or as a single, space-delimited string.
                    scopes: [
                        "https://www.googleapis.com/auth/documents.readonly",
                        "https://www.googleapis.com/auth/drive.readonly",
                    ],
                })
        }
        return OwidGoogleAuth.cachedGoogleReadonlyAuth
    }
}

// The base Gdoc class without any article specific fields
@Entity()
class GdocBase extends BaseEntity {
    @PrimaryColumn() id!: string
    @Column() slug: string = ""
    @Column({ default: "{}", type: "json" }) content!: Record<string, any>
    @Column() published: boolean = false
    @Column() createdAt: Date = new Date()
    @Column({ type: Date, nullable: true }) publishedAt: Date | null = null
    @UpdateDateColumn({ nullable: true }) updatedAt: Date | null = null
    @Column({ type: String, nullable: true }) revisionId: string | null = null
}

@Entity("posts_gdocs")
export class Gdoc extends GdocBase implements OwidGdocInterface {
    @Column({ default: "{}", type: "json" }) content!: OwidGdocContent
    @Column() publicationContext: OwidGdocPublicationContext =
        OwidGdocPublicationContext.unlisted
    @Column({ type: String, nullable: true }) revisionId: string | null = null
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

    linkedCharts: Record<string, LinkedChart> = {}
    relatedCharts: RelatedChart[] = []
    linkedDocuments: Record<string, Gdoc> = {}
    imageMetadata: Record<string, ImageMetadata> = {}
    errors: OwidGdocErrorMessage[] = []

    constructor(id?: string) {
        super()
        if (id) {
            this.id = id
        }
        this.content = {
            authors: ["Our World in Data team"],
        }
    }
    static table = "posts_gdocs"

    async fetchAndEnrichArticle(): Promise<void> {
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
        this.content = archieToEnriched(text)
    }

    get filenames(): string[] {
        const filenames: Set<string> = new Set()

        if (this.content["cover-image"]) {
            filenames.add(this.content["cover-image"])
        }
        if (this.content["featured-image"]) {
            filenames.add(this.content["featured-image"])
        }

        const enrichedBlockSources = [
            this.content.body,
            this.content.parsedFaqs &&
                Object.values(this.content.parsedFaqs).flatMap(
                    (faq) => faq.content
                ),
        ]

        for (const source of enrichedBlockSources) {
            source?.forEach((node) =>
                traverseEnrichedBlocks(node, (item) => {
                    if ("type" in item) {
                        if ("filename" in item && item.filename) {
                            filenames.add(item.filename)
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

        const enrichedBlockSources = [
            this.content.body,
            this.content.parsedFaqs &&
                Object.values(this.content.parsedFaqs).flatMap(
                    (faq) => faq.content
                ),
        ]

        for (const source of enrichedBlockSources) {
            source?.forEach((node) =>
                traverseEnrichedBlocks(
                    node,
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

    getLinkedImageFilenames(): string[] {
        // Used for prominent links
        const featuredImages = Object.values(this.linkedDocuments)
            .map((gdoc: Gdoc) => gdoc.content["featured-image"])
            .filter((filename?: string): filename is string => !!filename)

        return [...this.filenames, ...featuredImages]
    }

    async loadImageMetadata(): Promise<void> {
        const filenamesToLoad = this.getLinkedImageFilenames()
        if (filenamesToLoad.length) {
            await imageStore.fetchImageMetadata(filenamesToLoad)
            const images = await imageStore
                .syncImagesToS3()
                .then(excludeUndefined)
            this.imageMetadata = keyBy(images, "filename")
        }
    }

    getLinkedDocumentIds(): string[] {
        return uniq(
            this.links
                .filter((link) => link.linkType === "gdoc")
                .map((link) => link.target)
        )
    }

    async loadLinkedDocuments(): Promise<void> {
        const linkedDocuments = await Promise.all(
            this.getLinkedDocumentIds().map(async (target) => {
                const linkedDocument = await Gdoc.findOneBy({
                    id: target,
                })
                return linkedDocument
            })
        ).then(excludeNull)

        this.linkedDocuments = keyBy(linkedDocuments, "id")
    }

    getLinkedChartSlugs(): { grapher: string[]; explorer: string[] } {
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

        return { grapher: [...grapher], explorer: [...explorer] }
    }

    async loadLinkedCharts(
        publishedExplorersBySlug: Record<string, any>
    ): Promise<void> {
        const slugToIdMap = await Chart.mapSlugsToIds()
        const uniqueSlugsByLinkType = this.getLinkedChartSlugs()
        const linkedGrapherCharts = await Promise.all(
            [...uniqueSlugsByLinkType.grapher.values()].map(
                async (originalSlug) => {
                    const chartId = slugToIdMap[originalSlug]
                    if (!chartId) return
                    const chart = await Chart.findOneBy({ id: chartId })
                    if (!chart) return
                    const resolvedSlug = chart.config.slug ?? ""
                    const resolvedTitle = chart.config.title ?? ""
                    const linkedChart: LinkedChart = {
                        originalSlug,
                        title: resolvedTitle,
                        resolvedUrl: `${BAKED_GRAPHER_URL}/${resolvedSlug}`,
                        thumbnail: `${BAKED_GRAPHER_EXPORTS_BASE_URL}/${resolvedSlug}.svg`,
                    }
                    return linkedChart
                }
            )
        ).then(excludeNullish)

        const linkedExplorerCharts = await Promise.all(
            [...uniqueSlugsByLinkType.explorer.values()].map((originalSlug) => {
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

    get links(): Link[] {
        const links: Link[] = []
        const blocksToTraverse: OwidEnrichedGdocBlock[] = []
        if (this.content.body) {
            blocksToTraverse.push(...this.content.body)
        }
        if (this.content.refs?.definitions) {
            const refBlocks = Object.values(
                this.content.refs.definitions
            ).flatMap((definition) => definition.content)
            blocksToTraverse.push(...refBlocks)
        }
        if (this.content.parsedFaqs)
            blocksToTraverse.push(
                ...Object.values(this.content.parsedFaqs).flatMap(
                    (faq) => faq.content
                )
            )

        blocksToTraverse.map((node) =>
            traverseEnrichedBlocks(
                node,
                (node) => {
                    const extractedLinks = this.extractLinksFromNode(node)
                    if (extractedLinks) links.push(...extractedLinks)
                },
                (span) => {
                    const link = this.extractLinkFromSpan(span)
                    if (link) links.push(link)
                }
            )
        )

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

    extractLinksFromNode(node: OwidEnrichedGdocBlock): Link[] | void {
        const links: Link[] = match(node)
            .with({ type: "prominent-link" }, (node) => [
                Link.createFromUrl({
                    url: node.url,
                    source: this,
                    componentType: node.type,
                    text: node.title,
                }),
            ])
            .with({ type: "chart" }, (node) => [
                Link.createFromUrl({
                    url: node.url,
                    source: this,
                    componentType: node.type,
                }),
            ])
            .with({ type: "all-charts" }, (node) =>
                node.top.map((item) =>
                    Link.createFromUrl({
                        url: item.url,
                        source: this,
                        componentType: node.type,
                    })
                )
            )
            .with({ type: "recirc" }, (node) => {
                const links: Link[] = []

                node.links.forEach(({ url }, i) => {
                    links.push(
                        Link.createFromUrl({
                            url,
                            source: this,
                            componentType: node.type,
                            text: `Recirc link ${i + 1}`,
                        })
                    )
                })

                return links
            })
            .with({ type: "scroller" }, (node) => {
                const links: Link[] = []

                node.blocks.forEach(({ url, text }, i) => {
                    const chartLink = Link.createFromUrl({
                        url,
                        source: this,
                        componentType: node.type,
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
            .with({ type: "chart-story" }, (node) => {
                const links: Link[] = []

                node.items.forEach((storyItem, i) => {
                    const chartLink = Link.createFromUrl({
                        url: storyItem.chart.url,
                        source: this,
                        componentType: node.type,
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
            .with({ type: "topic-page-intro" }, (node) => {
                const links: Link[] = []

                if (node.downloadButton) {
                    const downloadButtonLink = Link.createFromUrl({
                        url: node.downloadButton.url,
                        source: this,
                        componentType: node.type,
                        text: node.downloadButton.text,
                    })
                    links.push(downloadButtonLink)
                }
                if (node.relatedTopics) {
                    node.relatedTopics.forEach((relatedTopic) => {
                        const relatedTopicLink = Link.createFromUrl({
                            url: relatedTopic.url,
                            source: this,
                            componentType: node.type,
                            text: relatedTopic.text ?? "",
                        })
                        links.push(relatedTopicLink)
                    })
                }

                node.content.forEach((textBlock) => {
                    textBlock.value.forEach((span) => {
                        traverseEnrichedSpan(span, (span) => {
                            const spanLink = this.extractLinkFromSpan(span)
                            if (spanLink) links.push(spanLink)
                        })
                    })
                })

                return links
            })
            .with({ type: "key-insights" }, (node) => {
                const links: Link[] = []

                // insights content is traversed by traverseEnrichedBlocks
                node.insights.forEach((insight) => {
                    if (insight.url) {
                        const insightLink = Link.createFromUrl({
                            url: insight.url,
                            source: this,
                            componentType: node.type,
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
                    // no urls directly on any of these components
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

        let dodErrors: OwidGdocErrorMessage[] = []
        // Validating the DoD document is infinitely recursive :)
        if (this.id !== GDOCS_DETAILS_ON_DEMAND_ID) {
            const { details } = await Gdoc.getDetailsOnDemandGdoc()
            dodErrors = this.details.reduce(
                (
                    acc: OwidGdocErrorMessage[],
                    detailId
                ): OwidGdocErrorMessage[] => {
                    if (details && !details[detailId]) {
                        acc.push({
                            type: OwidGdocErrorMessageType.Error,
                            message: `Invalid DoD referenced: "${detailId}"`,
                            property: "content",
                        })
                    }
                    return acc
                },
                []
            )
        }

        // A one-off custom validation for this particular case
        // Until we implement a more robust validation abstraction for fragments
        // This is to validate the details document itself
        // Whereas dodErrors is to validate *other documents* that are referencing dods
        const dodDocumentErrors: OwidGdocErrorMessage[] = []
        if (this.id === GDOCS_DETAILS_ON_DEMAND_ID) {
            const results = parseDetails(this.content.details)
            const errors: OwidGdocErrorMessage[] = results.parseErrors.map(
                (parseError) => ({
                    ...parseError,
                    property: "details",
                    type: OwidGdocErrorMessageType.Error,
                })
            )
            dodDocumentErrors.push(...errors)
        }

        const faqs = this.content.faqs
            ? parseFaqs(this.content.faqs, this.id)
            : undefined
        const faqErrors: OwidGdocErrorMessage[] = []
        if (faqs?.parseErrors.length) {
            const errors: OwidGdocErrorMessage[] = faqs.parseErrors.map(
                (parseError) => ({
                    ...parseError,
                    property: "faqs",
                    type: OwidGdocErrorMessageType.Error,
                })
            )
            faqErrors.push(...errors)
        }

        const allChartsErrors: OwidGdocErrorMessage[] = []
        if (this.hasAllChartsBlock && !this.tags.length) {
            allChartsErrors.push({
                property: "content",
                message: "No tags set on document for all-charts block to use",
                type: OwidGdocErrorMessageType.Error,
            })
        }

        this.errors = [
            ...filenameErrors,
            ...linkErrors,
            ...dodErrors,
            ...dodDocumentErrors,
            ...allChartsErrors,
            ...faqErrors,
        ]
    }

    static async getGdocFromContentSource(
        id: string,
        publishedExplorersBySlug: Record<string, any>,
        contentSource?: GdocsContentSource
    ): Promise<OwidGdocInterface> {
        const gdoc = await Gdoc.findOne({
            where: {
                id,
            },
            relations: ["tags"],
        })

        if (!gdoc) throw new JsonError(`No Google Doc with id ${id} found`)

        if (contentSource === GdocsContentSource.Gdocs) {
            await gdoc.fetchAndEnrichArticle()
        }

        if (gdoc.content.faqs && Object.values(gdoc.content.faqs).length) {
            const faqResults = parseFaqs(gdoc.content.faqs, gdoc.id)
            gdoc.content.parsedFaqs = faqResults.faqs
        }

        await gdoc.loadLinkedDocuments()
        await gdoc.loadImageMetadata()
        await gdoc.loadLinkedCharts(publishedExplorersBySlug)
        await gdoc.loadRelatedCharts()

        await gdoc.validate(publishedExplorersBySlug)

        return gdoc
    }

    static async getDetailsOnDemandGdoc(): Promise<{
        details: DetailDictionary
        parseErrors: ParseError[]
    }> {
        if (!GDOCS_DETAILS_ON_DEMAND_ID) {
            console.error(
                "GDOCS_DETAILS_ON_DEMAND_ID unset. No details can be loaded"
            )
            return { details: {}, parseErrors: [] }
        }
        const gdoc = await Gdoc.findOne({
            where: {
                id: GDOCS_DETAILS_ON_DEMAND_ID,
                published: true,
            },
        })

        if (!gdoc) {
            return {
                details: {},
                parseErrors: [
                    {
                        message: `Details on demand document with id "${GDOCS_DETAILS_ON_DEMAND_ID}" isn't registered and/or published. Please add it via ${ADMIN_BASE_URL}/admin/gdocs`,
                    },
                ],
            }
        }

        return parseDetails(gdoc.content.details)
    }

    static async getPublishedGdocs(): Promise<(Gdoc & OwidGdocPublished)[]> {
        // #gdocsvalidation this cast means that we trust the admin code and
        // workflow to provide published articles that have all the required content
        // fields (see #gdocsvalidationclient and pending #gdocsvalidationserver).
        // It also means that if a required field is added after the publication of
        // an article, there won't currently be any checks preventing the then
        // incomplete article to be republished (short of an error being raised down
        // the line). A migration should then be added to update current articles
        // with a sensible default for the new required content field. An
        // alternative would be to encapsulate that default in
        // mapGdocsToWordpressPosts(). This would make the Gdoc entity coming from
        // the database dependent on the mapping function, which is more practical
        // but also makes it less of a source of truth when considered in isolation.
        return Gdoc.find({
            where: {
                published: true,
                publishedAt: LessThanOrEqual(new Date()),
            },
            relations: ["tags"],
        }).then((gdocs) =>
            gdocs.filter(
                ({ content: { type } }) => type !== OwidGdocType.Fragment
            )
        ) as Promise<(OwidGdocPublished & Gdoc)[]>
    }

    /**
     * Excludes published listed Gdocs with a publication date in the future
     */
    static async getListedGdocs(): Promise<(Gdoc & OwidGdocPublished)[]> {
        return Gdoc.findBy({
            published: true,
            publicationContext: OwidGdocPublicationContext.listed,
            publishedAt: LessThanOrEqual(new Date()),
        }) as Promise<(Gdoc & OwidGdocPublished)[]>
    }

    get hasAllChartsBlock(): boolean {
        let hasAllChartsBlock = false
        if (this.content.body) {
            for (const node of this.content.body) {
                if (hasAllChartsBlock) break
                traverseEnrichedBlocks(node, (node) => {
                    if (node.type === "all-charts") {
                        hasAllChartsBlock = true
                    }
                })
            }
        }

        return hasAllChartsBlock
    }

    async loadRelatedCharts(): Promise<void> {
        if (!this.tags.length || !this.hasAllChartsBlock) return

        const connection = await getConnection()
        const relatedCharts = await connection.query(
            `
        SELECT DISTINCT
        charts.config->>"$.slug" AS slug,
        charts.config->>"$.title" AS title,
        charts.config->>"$.variantName" AS variantName,
        chart_tags.keyChartLevel
        FROM charts
        INNER JOIN chart_tags ON charts.id=chart_tags.chartId
        WHERE chart_tags.tagId IN (?)
        AND charts.config->>"$.isPublished" = "true"
        ORDER BY title ASC
        `,
            [this.tags.map((tag) => tag.id)]
        )

        this.relatedCharts = relatedCharts
    }
}
