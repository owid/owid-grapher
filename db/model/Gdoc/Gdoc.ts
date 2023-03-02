import {
    Entity,
    Column,
    BaseEntity,
    UpdateDateColumn,
    PrimaryColumn,
} from "typeorm"
import {
    OwidArticleContent,
    OwidArticleType,
    OwidArticleTypePublished,
    OwidArticlePublicationContext,
    GdocsContentSource,
    JsonError,
    OwidEnrichedArticleBlock,
    recursivelyMapArticleBlock,
    ImageNotFound,
    NoDefaultAlt,
} from "@ourworldindata/utils"
import {
    GDOCS_CLIENT_EMAIL,
    GDOCS_CLIENT_ID,
    GDOCS_PRIVATE_KEY,
} from "../../../settings/serverSettings.js"
import { google, Auth, docs_v1 } from "googleapis"
import { gdocToArchie } from "./gdocToArchie.js"
import { archieToEnriched } from "./archieToEnriched.js"
import { imageStore } from "../Image.js"

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
    @UpdateDateColumn({ nullable: true }) updatedAt: Date | null = null
    @Column({ type: String, nullable: true }) revisionId: string | null = null

    constructor(id?: string) {
        super()
        // TODO: the class is re-initializing every single auto-reload
        // Implement Page Visibility API ?
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
                // Scopes can be specified either as an array or as a single, space-delimited string.
                scopes: [
                    "https://www.googleapis.com/auth/documents.readonly",
                    "https://www.googleapis.com/auth/drive.readonly",
                ],
            })
        }
        return Gdoc.cachedGoogleReadonlyAuth
    }

    async getEnrichedArticle(): Promise<void> {
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

        // Get the filenames of the images referenced in the article
        const filenames = this.filenames

        if (filenames.length) {
            await imageStore.syncImagesToS3(filenames)
            this.setAdditionalImageMetadata()
        }
        return
    }

    get filenames(): string[] {
        return Gdoc.extractImagesFilenames(this.content)
    }

    static extractImagesFilenames(enriched: OwidArticleContent): string[] {
        const filenames: Set<string> = new Set()
        enriched.body?.forEach((node) =>
            recursivelyMapArticleBlock(node, (node) => {
                if (node.type === "image") {
                    filenames.add(node.filename)
                }
                return node
            })
        )

        return [...filenames]
    }

    setAdditionalImageMetadata(): void {
        this.content.body = this.content.body?.map((block) =>
            recursivelyMapArticleBlock(
                block,
                (block: OwidEnrichedArticleBlock) => {
                    if (block.type === "image") {
                        const metadata = imageStore.images?.[block.filename]
                        if (!metadata) {
                            block.dataErrors.push({ message: ImageNotFound })
                        } else {
                            block.originalWidth = metadata.originalWidth

                            // Error if default alt doesn't exist
                            // Use default alt if override isn't set
                            if (!metadata.defaultAlt) {
                                block.dataErrors.push({
                                    message: NoDefaultAlt,
                                })
                            } else if (!block.alt) {
                                block.alt = metadata.defaultAlt
                            }
                        }
                    }
                    return block
                }
            )
        )
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
