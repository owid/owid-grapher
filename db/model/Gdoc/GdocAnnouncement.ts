import {
    OwidGdocAnnouncementContent,
    OwidGdocAnnouncementInterface,
    OwidGdocBaseInterface,
    excludeNullish,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
} from "@ourworldindata/utils"
import { ANNOUNCEMENT_LATEST_TYPES } from "@ourworldindata/types"
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
            if (this.content.body?.length) {
                errors.push({
                    property: "content.cta",
                    message: `An announcement with a top-level {.cta} block must have an empty body. Either remove the body content (and keep the CTA), or remove the {.cta} block (and keep the body).`,
                    type: OwidGdocErrorMessageType.Error,
                })
            }
        }

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
