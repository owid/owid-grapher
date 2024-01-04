import { OwidGdocLinkType } from "@ourworldindata/types/dist/gdocTypes/Gdoc.js"
import {
    spansToUnformattedPlainText,
    gdocUrlRegex,
    Span,
    Url,
} from "@ourworldindata/utils"
import urlSlug from "url-slug"

export function getLinkType(urlString: string): OwidGdocLinkType {
    const url = Url.fromURL(urlString)
    if (url.isGoogleDoc) {
        return OwidGdocLinkType.Gdoc
    }
    if (url.isGrapher) {
        return OwidGdocLinkType.Grapher
    }
    if (url.isExplorer) {
        return OwidGdocLinkType.Explorer
    }
    return OwidGdocLinkType.Url
}

export function checkIsInternalLink(url: string): boolean {
    return ["gdoc", "grapher", "explorer"].includes(getLinkType(url))
}

export function getUrlTarget(urlString: string): string {
    const url = Url.fromURL(urlString)
    if (url.isGoogleDoc) {
        const gdocsMatch = urlString.match(gdocUrlRegex)
        if (gdocsMatch) {
            const [_, gdocId] = gdocsMatch
            return gdocId
        }
    }
    if ((url.isGrapher || url.isExplorer) && url.slug) {
        return url.slug
    }
    return urlString
}

export function convertHeadingTextToId(headingText: Span[]): string {
    return urlSlug(spansToUnformattedPlainText(headingText))
}
