import {
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocDataInsightContent,
    MinimalDataInsightInterface,
    OwidGdocMinimalPostInterface,
    OwidGdocBaseInterface,
    excludeNullish,
    OwidGdocAnnouncementsInterface,
    OwidGdocAnnouncementsContent,
} from "@ourworldindata/utils"
import { GdocBase } from "./GdocBase.js"
import * as db from "../../../db/db.js"

export class GdocAnnouncements
    extends GdocBase
    implements OwidGdocAnnouncementsInterface
{
    content!: OwidGdocAnnouncementsContent

    constructor(id?: string) {
        super()
        if (id) {
            this.id = id
        }
    }

    static create(obj: OwidGdocBaseInterface): GdocAnnouncements {
        const gdoc = new GdocAnnouncements()
        Object.assign(gdoc, obj)
        return gdoc
    }

    linkedDocuments: Record<string, OwidGdocMinimalPostInterface> = {}
    // TODO: support query parameters in grapher urls so we can track country selections

    protected typeSpecificUrls(): string[] {
        return []
    }

    _validateSubclass = async (): Promise<OwidGdocErrorMessage[]> => {
        const errors: OwidGdocErrorMessage[] = []
        return errors
    }

    _loadSubclassAttachments = async (
        knex: db.KnexReadonlyTransaction
    ): Promise<void> => {}
}
