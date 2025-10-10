import {
    OwidGdocAnnouncementContent,
    OwidGdocAnnouncementInterface,
    OwidGdocBaseInterface,
    excludeNullish,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
} from "@ourworldindata/utils"
import { GdocBase } from "./GdocBase.js"
import { extractUrl } from "./gdocUtils.js"

export class GdocAnnouncement
    extends GdocBase
    implements OwidGdocAnnouncementInterface
{
    declare content: OwidGdocAnnouncementContent

    constructor(id?: string) {
        super(id)
    }

    protected override typeSpecificUrls(): string[] {
        return excludeNullish([this.content.cta?.url])
    }

    override _validateSubclass = async (): Promise<OwidGdocErrorMessage[]> => {
        const errors: OwidGdocErrorMessage[] = []
        if (this.content.cta) {
            if (!this.content.cta?.url || !this.content.cta?.text) {
                errors.push({
                    property: "content.cta",
                    message: `If a top-level {.cta} property is set, its url and text value must be set.`,
                    type: OwidGdocErrorMessageType.Error,
                })
            }
        }

        return errors
    }

    override _enrichSubclassContent = (content: Record<string, any>): void => {
        if (content.cta?.url) {
            content.cta.url = extractUrl(content.cta.url)
        }
    }

    static create(obj: OwidGdocBaseInterface): GdocAnnouncement {
        const gdoc = new GdocAnnouncement(undefined)
        Object.assign(gdoc, obj)
        return gdoc
    }
}
