import { Entity, Column } from "typeorm"
import {
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocDataInsightContent,
    OwidGdocDataInsightInterface,
    OwidGdocPostInterface,
} from "@ourworldindata/utils"
import { GdocBase } from "./GdocBase.js"

@Entity("posts_gdocs")
export class GdocDataInsight
    extends GdocBase
    implements OwidGdocDataInsightInterface
{
    @Column({ default: "{}", type: "json" })
    content!: OwidGdocDataInsightContent

    constructor(id?: string) {
        super()
        if (id) {
            this.id = id
        }
    }

    linkedDocuments: Record<string, OwidGdocPostInterface> = {}

    _validateSubclass = async (): Promise<OwidGdocErrorMessage[]> => {
        const errors: OwidGdocErrorMessage[] = []
        if (!this.content["approved-by"]) {
            errors.push({
                type: OwidGdocErrorMessageType.Error,
                property: "approved-by",
                message: "Missing an approved-by field in the front-matter",
            })
        }
        return errors
    }
}
