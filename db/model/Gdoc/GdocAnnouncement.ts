import {
    OwidGdocAnnouncementContent,
    OwidGdocAnnouncementInterface,
    OwidGdocMinimalPostInterface,
    OwidGdocBaseInterface,
    LatestDataInsight,
} from "@ourworldindata/utils"
import { GdocBase } from "./GdocBase.js"

export class GdocAnnouncement
    extends GdocBase
    implements OwidGdocAnnouncementInterface
{
    declare content: OwidGdocAnnouncementContent

    constructor(id?: string) {
        super(id)
    }

    static create(obj: OwidGdocBaseInterface): GdocAnnouncement {
        const gdoc = new GdocAnnouncement(undefined)
        Object.assign(gdoc, obj)
        return gdoc
    }

    override linkedDocuments: Record<string, OwidGdocMinimalPostInterface> = {}
    override latestDataInsights: LatestDataInsight[] = []
}
