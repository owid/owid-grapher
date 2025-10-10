import {
    OwidGdocAnnouncementContent,
    OwidGdocAnnouncementInterface,
    OwidGdocMinimalPostInterface,
    OwidGdocBaseInterface,
    LatestDataInsight,
    excludeNullish,
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

    protected override typeSpecificUrls(): string[] {
        return excludeNullish([this.content["cta"]?.url])
    }

    static create(obj: OwidGdocBaseInterface): GdocAnnouncement {
        const gdoc = new GdocAnnouncement(undefined)
        Object.assign(gdoc, obj)
        return gdoc
    }

    override linkedDocuments: Record<string, OwidGdocMinimalPostInterface> = {}
    override latestDataInsights: LatestDataInsight[] = []
}
