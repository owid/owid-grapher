import { Entity, PrimaryColumn, Column, BaseEntity } from "typeorm"
import {
    OwidArticleContent,
    OwidArticleType,
    OwidArticleTypePublished,
    OwidArticlePublicationContext,
    GdocsContentSource,
    JsonError,
    recursivelyMapArticleContent,
    checkNodeIsSpan,
    spansToUnformattedPlainText,
    OwidEnrichedArticleBlock,
    Span,
    keyBy,
} from "@ourworldindata/utils"
import {
    GDOCS_CLIENT_EMAIL,
    GDOCS_CLIENT_ID,
    GDOCS_PRIVATE_KEY,
} from "../../../settings/serverSettings.js"
import { google, Auth, docs_v1 } from "googleapis"
import { gdocToArchie } from "./gdocToArchie.js"
import { archieToEnriched } from "./archieToEnriched.js"
import { getUrlTarget, getUrlType, Link } from "../Link.js"
import { Dictionary } from "lodash"

@Entity("posts_gdocs")
export class Gdoc extends BaseEntity implements OwidArticleType {
    @PrimaryColumn() id!: string
    @Column() slug: string = ""
    @Column({ default: "{}", type: "json" }) content!: OwidArticleContent
    @Column() published: boolean = false
    @Column() publicationContext: OwidArticlePublicationContext =
        OwidArticlePublicationContext.unlisted
    @Column() createdAt: Date = new Date()
    @Column({ type: Date, nullable: true }) publishedAt: Date | null = null
    @Column({ type: Date, nullable: true }) updatedAt: Date | null = null
    @Column({ type: String, nullable: true }) revisionId: string | null = null
    links: Link[] = []

    constructor(id?: string) {
        super()
        if (id) {
            this.id = id
        }
        this.content = {}
    }
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
                scopes: ["https://www.googleapis.com/auth/documents.readonly"],
            })
        }
        return Gdoc.cachedGoogleReadonlyAuth
    }

    async getEnrichedArticle(): Promise<void> {
        const client = google.docs({
            version: "v1",
            auth: Gdoc.getGoogleReadonlyAuth(),
        })

        // Retrieve raw data from Google
        const { data } = await client.documents.get({
            documentId: this.id,
            suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
        })

        // Convert the doc to ArchieML syntax
        const { text } = await gdocToArchie(data)

        // Convert the ArchieML to our enriched JSON structure
        this.content = archieToEnriched(text)

        this.content = await this.processContent(this.content)

        this.revisionId = data.revisionId ?? null
    }

    // a combination of pure and impure functions where the order of operations is important
    async processContent(
        content: OwidArticleContent
    ): Promise<OwidArticleContent> {
        const links: Link[] = []
        const allGdocs = await Gdoc.find()
        const gdocsDictionary = keyBy(allGdocs, "id")
        if (content.body) {
            content.body = content.body.map((node) =>
                recursivelyMapArticleContent(node, (node) => {
                    this.extractLinks(node, links)
                    this.replaceLinks(node, gdocsDictionary)
                    return node
                })
            )
        }
        this.links = links
        return content
    }

    // If the node has a URL in it, create a Link object
    // then push it into the link array from the parent closure
    extractLinks(node: OwidEnrichedArticleBlock | Span, links: Link[]): void {
        function getText(node: OwidEnrichedArticleBlock | Span): string {
            // Can add component-specific text accessors here
            if (checkNodeIsSpan(node)) {
                if (node.spanType == "span-link") {
                    return spansToUnformattedPlainText(node.children)
                }
            } else if (node.type === "prominent-link") return node.title
            return ""
        }
        if ("url" in node) {
            const link: Link = Link.create({
                type: getUrlType(node.url),
                source: this,
                target: getUrlTarget(node.url),
                context: checkNodeIsSpan(node) ? "inline" : node.type,
                text: getText(node),
            })
            links.push(link)
        }
    }

    // Replace gdoc links with their corresponding slugs
    // IMPURE
    replaceLinks<Node extends OwidEnrichedArticleBlock | Span>(
        node: Node,
        gdocsDictionary: Dictionary<Gdoc>
    ): Node {
        if ("url" in node && getUrlType(node.url) === "gdoc") {
            const targetGdocId = getUrlTarget(node.url)
            const targetGdoc = gdocsDictionary[targetGdocId]
            if (!targetGdoc) return node
            // TODO: handle this flow once images branch is merged
            // throw new Error(`Document with ID ${targetGdocId} not found`)
            node.url = "/" + targetGdoc.slug
        }
        return node
    }

    static async getGdocFromContentSource(
        id: string,
        contentSource?: GdocsContentSource
    ): Promise<OwidArticleType> {
        const gdoc = await Gdoc.findOneBy({ id })

        if (!gdoc) throw new JsonError(`No Google Doc with id ${id} found`)

        if (contentSource === GdocsContentSource.Gdocs) {
            await gdoc.getEnrichedArticle()
        }
        return gdoc
    }

    static async getPublishedGdocs(): Promise<OwidArticleTypePublished[]> {
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
        return Gdoc.findBy({ published: true }) as Promise<
            OwidArticleTypePublished[]
        >
    }

    static async getListedGdocs(): Promise<OwidArticleTypePublished[]> {
        return Gdoc.findBy({
            published: true,
            publicationContext: OwidArticlePublicationContext.listed,
        }) as Promise<OwidArticleTypePublished[]>
    }
}
