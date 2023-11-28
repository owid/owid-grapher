import {
    Entity,
    Column,
    BaseEntity,
    PrimaryColumn,
    ManyToMany,
    JoinTable,
    LessThanOrEqual,
} from "typeorm"
import {
    Tag as TagInterface,
    type OwidGdocContent,
    OwidGdocInterface,
    OwidGdocPublished,
    OwidGdocPublicationContext,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    DetailDictionary,
    ParseError,
    OwidGdocType,
    traverseEnrichedBlocks,
    OwidEnrichedGdocBlock,
    BreadcrumbItem,
    RawBlockText,
} from "@ourworldindata/utils"
import { GDOCS_DETAILS_ON_DEMAND_ID } from "../../../settings/serverSettings.js"
import {
    formatCitation,
    generateStickyNav,
    generateToc,
} from "./archieToEnriched.js"
import { ADMIN_BASE_URL } from "../../../settings/clientSettings.js"
import { parseDetails } from "./rawToEnriched.js"
import { getConnection } from "../../db.js"
import { htmlToEnrichedTextBlock } from "./htmlToEnriched.js"
import { GdocBase } from "./GdocBase.js"

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

@Entity("posts_gdocs")
export class Gdoc extends GdocBase implements OwidGdocInterface {
    static table = "posts_gdocs"
    @Column({ default: "{}", type: "json" }) content!: OwidGdocContent
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

    constructor(id?: string) {
        super()
        if (id) {
            this.id = id
        }
        this.content = {
            authors: ["Our World in Data team"],
        }
    }

    _filenameProperties = ["cover-image", "featured-image"]

    _getSubclassEnrichedBlocks = (gdoc: this): OwidEnrichedGdocBlock[] => {
        const enrichedBlocks: OwidEnrichedGdocBlock[] = []

        // TODO: sort this out later, probably a good candidate for its own subclass
        // Object.values(gdoc.parsedFaqs).flatMap((faq) => faq.content)

        if (gdoc.content.refs?.definitions) {
            const refBlocks = Object.values(
                gdoc.content.refs.definitions
            ).flatMap((definition) => definition.content)
            enrichedBlocks.push(...refBlocks)
        }

        return enrichedBlocks
    }

    _enrichSubclassContent = (content: Record<string, any>): void => {
        const isTocForSidebar = content["sidebar-toc"] === "true"
        content.toc = generateToc(content.body, isTocForSidebar)

        if (content.summary) {
            content.summary = content.summary.map((html: RawBlockText) =>
                htmlToEnrichedTextBlock(html.value)
            )
        }

        content.citation = formatCitation(content.citation)

        content["sticky-nav"] = generateStickyNav(content as any)
    }

    _validateSubclass = (): OwidGdocErrorMessage[] => {
        const errors: OwidGdocErrorMessage[] = []

        if (this.hasAllChartsBlock && !this.tags.length) {
            errors.push({
                property: "content",
                message: "No tags set on document for all-charts block to use",
                type: OwidGdocErrorMessageType.Error,
            })
        }

        return errors
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
