import { Entity, Column } from "typeorm"
import {
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidInsightContent,
    OwidGdocInsightInterface,
    OwidGdocPostInterface,
} from "@ourworldindata/utils"
import { GdocBase } from "./GdocBase.js"

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
