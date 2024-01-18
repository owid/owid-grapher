import { Entity, Column } from "typeorm"
import {
    OwidGdocErrorMessage,
    OwidGdocHomepageContent,
    OwidGdocHomepageInterface,
    OwidGdocMinimalPostInterface,
} from "@ourworldindata/utils"
import { GdocBase } from "./GdocBase.js"

@Entity("posts_gdocs")
export class GdocHomepage
    extends GdocBase
    implements OwidGdocHomepageInterface
{
    @Column({ default: "{}", type: "json" })
    content!: OwidGdocHomepageContent

    constructor(id?: string) {
        super()
        if (id) {
            this.id = id
        }
    }

    linkedDocuments: Record<string, OwidGdocMinimalPostInterface> = {}
    _urlProperties: string[] = []

    _validateSubclass = async (): Promise<OwidGdocErrorMessage[]> => {
        const errors: OwidGdocErrorMessage[] = []
        return errors
    }

    _loadSubclassAttachments = async (): Promise<void> => {}
}
