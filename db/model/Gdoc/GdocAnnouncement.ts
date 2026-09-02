import {
    OwidGdocAnnouncementContent,
    OwidGdocAnnouncementInterface,
    OwidGdocBaseInterface,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
} from "@ourworldindata/utils"
import { ANNOUNCEMENT_LATEST_TYPES } from "@ourworldindata/types"
import { GdocBase } from "./GdocBase.js"

export class GdocAnnouncement
    extends GdocBase
    implements OwidGdocAnnouncementInterface
{
    declare content: OwidGdocAnnouncementContent

    constructor(id?: string) {
        super(id)
    }

    override _validateSubclass = async (): Promise<OwidGdocErrorMessage[]> => {
        const errors: OwidGdocErrorMessage[] = []

        // The kicker drives the announcement's category on /latest. Reject
        // unrecognized values at publish time so the indexer never has to
        // guess a fallback.
        if (this.content.kicker) {
            if (
                !(ANNOUNCEMENT_LATEST_TYPES as readonly string[]).includes(
                    this.content.kicker
                )
            ) {
                errors.push({
                    property: "content.kicker",
                    message: `Unrecognized announcement kicker "${this.content.kicker}". Allowed values: ${ANNOUNCEMENT_LATEST_TYPES.join(", ")}.`,
                    type: OwidGdocErrorMessageType.Error,
                })
            }
        }

        return errors
    }

    static create(obj: OwidGdocBaseInterface): GdocAnnouncement {
        const gdoc = new GdocAnnouncement(undefined)
        Object.assign(gdoc, obj)
        return gdoc
    }
}
