import { Entity, PrimaryColumn, Column, BaseEntity } from "typeorm"
import {
    OwidArticleContent,
    OwidArticleType,
    OwidArticleTypePublished,
    OwidArticlePublicationContext,
    uniq,
    keyBy,
    isEmpty,
} from "@ourworldindata/utils"
import {
    GDOCS_CLIENT_EMAIL,
    GDOCS_CLIENT_ID,
    GDOCS_PRIVATE_KEY,
} from "../../../settings/serverSettings.js"
import { google, Auth, docs_v1, drive_v3 } from "googleapis"

import { gdocToArchie } from "./gdocToArchie.js"
import { archieToEnriched } from "./archieToEnriched.js"
import { Image, ImageMeta } from "../Image.js"

const GOOGLE_DRIVE_IMAGES_FOLDER_ID = "1dfArzg3JrAJupVl4YyJpb2FOnBn4irPX"

interface GDriveImageMeta {
    name: string
    modifiedTime: string
    id: string // Google Drive ID
    description: string
}

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

    constructor(id?: string) {
        super()
        // TODO: the class is re-initializing every single auto-reload
        // Implement Page Visibility API ?
        if (id) {
            this.id = id
        }
        this.cachedImageList = {}
        this.content = {}
    }
    static cachedGoogleAuth?: Auth.GoogleAuth
    static cachedGoogleClient?: docs_v1.Docs

    cachedImageList: Record<string, ImageMeta>

    static getGoogleAuth(): Auth.GoogleAuth {
        if (!Gdoc.cachedGoogleAuth) {
            Gdoc.cachedGoogleAuth = new google.auth.GoogleAuth({
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
        return Gdoc.cachedGoogleAuth
    }

    static getGoogleClient(): docs_v1.Docs {
        if (!Gdoc.cachedGoogleClient) {
            Gdoc.cachedGoogleClient = google.docs({
                version: "v1",
                auth: Gdoc.cachedGoogleAuth,
            })
        }
        return Gdoc.cachedGoogleClient
    }

    async getEnrichedArticle(): Promise<void> {
        const docsClient = google.docs({
            version: "v1",
            auth: Gdoc.getGoogleAuth(),
        })

        // Retrieve raw data from Google
        const { data } = await docsClient.documents.get({
            documentId: this.id,
        })

        // Convert the doc to ArchieML syntax
        const { text } = await gdocToArchie(data)

        // Convert the ArchieML to our enriched JSON structure
        const content = archieToEnriched(text)

        // Get the filenames of the images referenced in the article
        const filenames = await this.extractImages(content)

        // At the moment, isEmpty will always be true, because the server is instantiating a new Gdoc every time
        if (filenames.length && isEmpty(this.cachedImageList)) {
            await this.fetchDriveImageData()
        }

        await Promise.all(
            filenames.map((filename) =>
                Image.syncImage(this.cachedImageList[filename])
            )
        )

        this.content = content
    }

    async fetchDriveImageData(): Promise<void> {
        const driveClient = google.drive({
            version: "v3",
            auth: Gdoc.getGoogleAuth(),
        })
        try {
            // TODO: fetch all pages (current limit = 1000)
            const res = await driveClient.files.list({
                // modifiedTime format: "2023-01-11T19:45:27.000Z"
                fields: "nextPageToken, files(id, name, description, webContentLink, modifiedTime)",
                q: `'${GOOGLE_DRIVE_IMAGES_FOLDER_ID}' in parents`,
            })

            const files = res.data.files ?? []

            function validateImage(
                image: drive_v3.Schema$File
            ): image is GDriveImageMeta {
                // image.description can be undefined or "", which we should handle
                return Boolean(image.id && image.name && image.modifiedTime)
            }

            const images: ImageMeta[] = files
                .filter(validateImage)
                .map(
                    ({
                        id,
                        name,
                        description,
                        modifiedTime,
                    }: GDriveImageMeta) => ({
                        googleId: id,
                        filename: name,
                        defaultAlt: description,
                        updatedAt: new Date(modifiedTime).getTime(),
                    })
                )

            this.cachedImageList = keyBy(images, "filename")
        } catch (e) {
            console.log("Error fetching images from Drive", e)
        }
    }

    async extractImages(enriched: OwidArticleContent): Promise<string[]> {
        const articleString = JSON.stringify(enriched.body)

        // quick solution instead of tree traversal
        const matches = [...articleString.matchAll(/"filename":"([\w\.\-]+)"/g)]

        const filenames: string[] = uniq(
            matches.map(([_, filename]) => filename)
        )

        // lol
        // just for testing, don't actually do this
        // filenames.forEach((filename) => {
        //     if (this.cachedImageList[filename]) {
        //         articleString = articleString.replaceAll(
        //             filename,
        //             this.cachedImageList[filename].webContentLink
        //         )
        //     }
        // })
        // enriched.body = JSON.parse(articleString)

        return filenames
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
