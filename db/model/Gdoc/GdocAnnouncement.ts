import {
    ANNOUNCEMENT_LATEST_TYPES,
    deriveAnnouncementLatestType,
    LatestAnnouncement,
    OwidGdocAnnouncementContent,
    OwidGdocAnnouncementInterface,
    OwidGdocBaseInterface,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
} from "@ourworldindata/utils"
import * as db from "../../../db/db.js"
import { GdocBase } from "./GdocBase.js"
import { getLatestAnnouncements } from "./GdocFactory.js"

export class GdocAnnouncement
    extends GdocBase
    implements OwidGdocAnnouncementInterface
{
    declare content: OwidGdocAnnouncementContent

    constructor(id?: string) {
        super(id)
    }

    override latestAnnouncements: LatestAnnouncement[] = []

    /** The carousel at the bottom of an announcement page shows the most
     * recent announcements of the same kind, so which announcements we attach
     * depends on this one's kicker. */
    override _loadSubclassAttachments = async (
        knex: db.KnexReadWriteTransaction
    ): Promise<void> => {
        const { announcements, imageMetadata } = await getLatestAnnouncements(
            knex,
            deriveAnnouncementLatestType(this.content.kicker)
        )
        this.latestAnnouncements = announcements
        this.imageMetadata = { ...this.imageMetadata, ...imageMetadata }
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
