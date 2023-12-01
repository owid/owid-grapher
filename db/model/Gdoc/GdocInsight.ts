import { Entity, Column } from "typeorm"
import {
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidInsightContent,
    OwidGdocInsightInterface,
    OwidGdocPostInterface,
} from "@ourworldindata/utils"
import { GdocBase } from "./GdocBase.js"

/**
 * This is an unused mock prototype, I think *something* like this could work,
 * but we'd need a different code path for registering FAQs through the server
 * instead of using the same endpoint for both posts and faqs.
 * For now, we'll just use the GdocPost class.
 */
@Entity("posts_gdocs")
export class OwidInsight extends GdocBase implements OwidGdocInsightInterface {
    static table = "posts_gdocs"
    @Column({ default: "{}", type: "json" }) content!: OwidInsightContent

    constructor(id?: string) {
        super()
        if (id) {
            this.id = id
        }
    }

    linkedDocuments: Record<string, OwidGdocPostInterface> = {}

    _validateSubclass = async (): Promise<OwidGdocErrorMessage[]> => {
        const errors: OwidGdocErrorMessage[] = []
        if (!this.content.approvedBy) {
            errors.push({
                type: OwidGdocErrorMessageType.Error,
                property: "approvedBy",
                message: "Missing an approvedBy field in the front-matter",
            })
        }
        return errors
    }
}
