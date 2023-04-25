import {
    Entity,
    Column,
    BaseEntity,
    UpdateDateColumn,
    PrimaryColumn,
    ManyToMany,
    JoinTable,
} from "typeorm"
import {
    OwidGdocTag,
    LinkedChart,
    OwidGdocContent,
    OwidGdocInterface,
    OwidGdocPublished,
    OwidGdocPublicationContext,
    GdocsContentSource,
    JsonError,
    checkNodeIsSpan,
    spansToUnformattedPlainText,
    getUrlTarget,
    getLinkType,
    keyBy,
    excludeNull,
    recursivelyMapArticleContent,
    ImageMetadata,
    excludeUndefined,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    NodeWithUrl,
    excludeNullish,
} from "@ourworldindata/utils"
import {
    BAKED_GRAPHER_URL,
    GDOCS_CLIENT_EMAIL,
    GDOCS_CLIENT_ID,
    GDOCS_PRIVATE_KEY,
} from "../../../settings/serverSettings.js"
import { google, Auth, docs_v1 } from "googleapis"
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
import { formatUrls } from "../../../site/formatting.js"

@Entity("tags")
export class Tag extends BaseEntity implements OwidGdocTag {
    static table = "tags"
    @PrimaryColumn() id!: number
    @Column() name!: string
    @Column() createdAt!: Date
    @Column({ nullable: true }) updatedAt!: Date
    @Column({ nullable: true }) parentId!: number
    @Column() isBulkImport!: boolean
    @Column() specialType!: string
    @ManyToMany(() => Gdoc, (gdoc) => gdoc.tags)
    gdocs!: Gdoc[]
}

@Entity("posts_gdocs")
export class Gdoc extends BaseEntity implements OwidGdocInterface {
    @PrimaryColumn() id!: string
    @Column() slug: string = ""
    @Column({ default: "{}", type: "json" }) content!: OwidGdocContent
    @Column() published: boolean = false
    @Column() publicationContext: OwidGdocPublicationContext =
        OwidGdocPublicationContext.unlisted
    @Column() createdAt: Date = new Date()
    @Column({ type: Date, nullable: true }) publishedAt: Date | null = null
    @UpdateDateColumn({ nullable: true }) updatedAt: Date | null = null
    @Column({ type: String, nullable: true }) revisionId: string | null = null

    @ManyToMany(() => Tag)
    @JoinTable({
        name: "posts_gdocs_x_tags",
        joinColumn: { name: "gdocId", referencedColumnName: "id" },
        inverseJoinColumn: { name: "tagId", referencedColumnName: "id" },
    })
    tags!: Tag[]

    linkedCharts: Record<string, LinkedChart> = {}
    linkedDocuments: Record<string, Gdoc> = {}
    imageMetadata: Record<string, ImageMetadata> = {}
    errors: OwidGdocErrorMessage[] = []

    constructor(id?: string) {
        super()
        // TODO: the class is re-initializing every single auto-reload
        // Implement Page Visibility API ?
        if (id) {
            this.id = id
        }
        this.content = {
            authors: ["Our World In Data"],
        }
    }
    static table = "posts_gdocs"
    static cachedGoogleReadonlyAuth?: Auth.GoogleAuth
    static cachedGoogleReadWriteAuth?: Auth.GoogleAuth
    static cachedGoogleClient?: docs_v1.Docs

    static getGoogleReadWriteAuth(): Auth.GoogleAuth {
        if (!Gdoc.cachedGoogleReadWriteAuth) {
            Gdoc.cachedGoogleReadWriteAuth = new google.auth.GoogleAuth({
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
        return Gdoc.cachedGoogleReadWriteAuth
    }

    static getGoogleReadonlyAuth(): Auth.GoogleAuth {
        if (!Gdoc.cachedGoogleReadonlyAuth) {
            Gdoc.cachedGoogleReadonlyAuth = new google.auth.GoogleAuth({
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
        return Gdoc.cachedGoogleReadonlyAuth
    }

    async fetchAndEnrichArticle(): Promise<void> {
        const docsClient = google.docs({
            version: "v1",
            auth: Gdoc.getGoogleReadonlyAuth(),
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

        if (this.content.cover) {
            filenames.add(this.content.cover)
        }

        this.content.body?.forEach((node) =>
            recursivelyMapArticleContent(node, (item) => {
                if ("type" in item) {
                    if (item.type === "image") {
                        filenames.add(item.filename)
                    }
                    if (item.type === "prominent-link" && item.thumbnail) {
                        filenames.add(item.thumbnail)
                    }
                }
                return item
            })
        )

        return [...filenames]
    }

    async loadImageMetadata(): Promise<void> {
        const covers: string[] = Object.values(this.linkedDocuments)
            .map((gdoc: Gdoc) => gdoc.content.cover)
            .filter((cover?: string): cover is string => !!cover)

        const filenamesToLoad: string[] = [...this.filenames, ...covers]

        if (filenamesToLoad.length) {
            await imageStore.fetchImageMetadata(filenamesToLoad)
            const images = await imageStore
                .syncImagesToS3()
                .then(excludeUndefined)
            this.imageMetadata = keyBy(images, "filename")
        }
    }

    async loadLinkedDocuments(): Promise<void> {
        const linkedDocuments = await Promise.all(
            this.links
                .filter((link) => link.linkType === "gdoc")
                .map((link) => link.target)
                // filter duplicates
                .filter((target, i, links) => links.indexOf(target) === i)
                .map(async (target) => {
                    const linkedDocument = await Gdoc.findOneBy({
                        id: target,
                    })
                    return linkedDocument
                })
        ).then(excludeNull)

        this.linkedDocuments = keyBy(linkedDocuments, "id")
    }

    async loadLinkedCharts(
        publishedExplorersBySlug: Record<string, any>
    ): Promise<void> {
        const slugToIdMap = await Chart.mapSlugsToIds()
        const uniqueSlugsByLinkType = this.links.reduce(
            (slugsByLinkType, { linkType, target }) => {
                if (linkType === "grapher" || linkType === "explorer") {
                    slugsByLinkType[linkType].add(target)
                }
                return slugsByLinkType
            },
            { grapher: new Set<string>(), explorer: new Set<string>() }
        )

        const linkedGrapherCharts = await Promise.all(
            [...uniqueSlugsByLinkType.grapher.values()].map(async (slug) => {
                const chartId = slugToIdMap[slug]
                const chart = await Chart.findOneBy({ id: chartId })
                if (!chart) return
                const resolvedSlug = chart.config.slug ?? ""
                const linkedChart: LinkedChart = {
                    slug: resolvedSlug,
                    title: chart?.config.title ?? "",
                    path: `${BAKED_GRAPHER_URL}/${slug}`,
                    thumbnail: `${BAKED_GRAPHER_EXPORTS_BASE_URL}/${chart?.config.slug}.svg`,
                }
                return linkedChart
            })
        ).then(excludeNullish)

        const linkedExplorerCharts = await Promise.all(
            [...uniqueSlugsByLinkType.explorer.values()].map((slug) => {
                const explorer = publishedExplorersBySlug[slug]
                if (!explorer) return
                const linkedChart: LinkedChart = {
                    slug,
                    title: explorer?.explorerTitle ?? "",
                    path: `${BAKED_BASE_URL}/${EXPLORERS_ROUTE_FOLDER}/${slug}`,
                    thumbnail: `${BAKED_BASE_URL}/default-thumbnail.jpg`,
                }
                return linkedChart
            })
        ).then(excludeNullish)

        this.linkedCharts = keyBy(
            [...linkedGrapherCharts, ...linkedExplorerCharts],
            "slug"
        )
    }

    get links(): Link[] {
        const links: Link[] = []
        if (this.content.body) {
            this.content.body.map((node) =>
                recursivelyMapArticleContent(node, (node) => {
                    const link = this.extractLinkFromNode(node)
                    if (link) links.push(link)
                    return node
                })
            )
        }
        return links
    }

    // Assumes that the property will be named "url"
    extractLinkFromNode(node: NodeWithUrl): Link | void {
        function getText(node: NodeWithUrl): string {
            // Can add component-specific text accessors here
            if (checkNodeIsSpan(node)) {
                if (node.spanType === "span-link") {
                    return spansToUnformattedPlainText(node.children)
                }
            } else if (node.type === "prominent-link") return node.title || ""
            return ""
        }

        // Don't track the ref links e.g. "#note-1"
        function checkIsRefAnchor(link: string): boolean {
            return new RegExp(/^#note-\d+$/).test(link)
        }

        if ("url" in node && !checkIsRefAnchor(node.url)) {
            const link: Link = Link.create({
                linkType: getLinkType(node.url),
                source: this,
                target: getUrlTarget(formatUrls(node.url)),
                componentType: checkNodeIsSpan(node) ? "span-link" : node.type,
                text: getText(node),
            })
            return link
        }
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
        this.errors = [...filenameErrors, ...linkErrors]
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

        await gdoc.loadLinkedDocuments()
        await gdoc.loadImageMetadata()
        await gdoc.loadLinkedCharts(publishedExplorersBySlug)

        await gdoc.validate(publishedExplorersBySlug)

        return gdoc
    }

    static async getPublishedGdocs(): Promise<Gdoc[]> {
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
        return Gdoc.find({ where: { published: true }, relations: ["tags"] })
    }

    static async getListedGdocs(): Promise<OwidGdocPublished[]> {
        return Gdoc.findBy({
            published: true,
            publicationContext: OwidGdocPublicationContext.listed,
        }) as Promise<OwidGdocPublished[]>
    }
}
