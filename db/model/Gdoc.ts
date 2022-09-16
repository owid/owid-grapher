import { Entity, PrimaryColumn, Column, BaseEntity } from "typeorm"
import { docToArchieML } from "@ourworldindata/doc-to-archieml"
import { OwidArticleContent } from "../../clientUtils/owidTypes.js"
import {
    GDOCS_CLIENT_EMAIL,
    GDOCS_CLIENT_ID,
    GDOCS_PRIVATE_KEY,
} from "../../settings/serverSettings.js"
import { GoogleAuth } from "google-auth-library"

@Entity("posts_gdocs")
export class Gdoc extends BaseEntity {
    @PrimaryColumn() id!: string
    @Column() slug!: string
    @Column() title!: string
    @Column({ default: "{}", type: "json" }) content!: OwidArticleContent
    @Column() published!: boolean
    @Column() createdAt!: Date
    @Column() updatedAt!: Date

    static cachedGoogleAuth?: GoogleAuth

    static getGoogleAuth(): GoogleAuth {
        if (!Gdoc.cachedGoogleAuth) {
            console.log("getting new credentials")
            Gdoc.cachedGoogleAuth = new GoogleAuth({
                credentials: {
                    type: "service_account",
                    private_key: GDOCS_PRIVATE_KEY.split("\\n").join("\n"),
                    client_email: GDOCS_CLIENT_EMAIL,
                    client_id: GDOCS_CLIENT_ID,
                },
                // Scopes can be specified either as an array or as a single, space-delimited string.
                scopes: ["https://www.googleapis.com/auth/documents.readonly"],
            })
        }
        return Gdoc.cachedGoogleAuth
    }

    async getDraftContent(): Promise<OwidArticleContent> {
        const auth = Gdoc.getGoogleAuth()

        return docToArchieML({
            documentId: this.id,
            auth,
        }) as Promise<OwidArticleContent>
    }
}
