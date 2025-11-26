import {
    OwidGdocAnnouncementContent,
    OwidGdocAnnouncementInterface,
    OwidGdocBaseInterface,
    excludeNullish,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    Url,
} from "@ourworldindata/utils"
import { GdocBase } from "./GdocBase.js"
import { extractUrl } from "./gdocUtils.js"
import { getUrlTarget } from "@ourworldindata/components"

export class GdocAnnouncement
    extends GdocBase
    implements OwidGdocAnnouncementInterface
{
    declare content: OwidGdocAnnouncementContent

    constructor(id?: string) {
        super(id)
    }

    protected override typeSpecificUrls(): string[] {
        return excludeNullish([
            this.content.cta?.url,
            this.content["source-document"],
        ])
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

        if (this.content.spotlight) {
            if (!this.content["homepage-title"]) {
                errors.push({
                    property: "homepage-title",
                    message:
                        "Spotlight announcements require a homepage-title for the homepage listing.",
                    type: OwidGdocErrorMessageType.Error,
                })
            }
            if (!this.content["source-document"]) {
                errors.push({
                    property: "source-document",
                    message:
                        "Spotlight announcements must specify a source-document URL for the canonical target.",
                    type: OwidGdocErrorMessageType.Error,
                })
            }
            if (this.content.cta) {
                errors.push({
                    property: "spotlight",
                    message:
                        "Spotlight announcements cannot include a CTA. Remove spotlight or remove the CTA.",
                    type: OwidGdocErrorMessageType.Error,
                })
            }

            if (this.content["source-document"]) {
                const parsed = Url.fromURL(this.content["source-document"])
                if (parsed.hash) {
                    errors.push({
                        property: "source-document",
                        message:
                            "source-document must not include anchors or fragments.",
                        type: OwidGdocErrorMessageType.Error,
                    })
                }

                const target = getUrlTarget(this.content["source-document"])
                const linkedDoc = this.linkedDocuments?.[target]
                if (!linkedDoc) {
                    errors.push({
                        property: "source-document",
                        message: `source-document must link to a published gdoc, but no linked document was found for target "${target}".`,
                        type: OwidGdocErrorMessageType.Error,
                    })
                } else if (!linkedDoc.published) {
                    errors.push({
                        property: "source-document",
                        message: `source-document must link to a published gdoc, but "${linkedDoc.slug}" is not published.`,
                        type: OwidGdocErrorMessageType.Error,
                    })
                }
            }
        }

        return errors
    }

    override _enrichSubclassContent = (content: Record<string, any>): void => {
        if (content.cta?.url) {
            content.cta.url = extractUrl(content.cta.url)
        }
        if (content["source-document"]) {
            content["source-document"] = extractUrl(content["source-document"])
        }
    }

    static create(obj: OwidGdocBaseInterface): GdocAnnouncement {
        const gdoc = new GdocAnnouncement(undefined)
        Object.assign(gdoc, obj)
        return gdoc
    }
}
