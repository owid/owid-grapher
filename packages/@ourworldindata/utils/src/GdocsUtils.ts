import { spansToUnformattedPlainText } from "./Util.js"
import { OwidGdocLinkJSON, Span } from "./owidTypes.js"
import { Url } from "./urls/Url.js"
import urlSlug from "url-slug"

// For use in the sticky nav and the component implementation
export const ALL_CHARTS_ID = "all-charts"
export const KEY_INSIGHTS_ID = "key-insights"
export const LICENSE_ID = "article-licence"
export const CITATION_ID = "article-citation"
export const ENDNOTES_ID = "article-endnotes"
export const RESEARCH_AND_WRITING_ID = "research-writing"

export const IMAGES_DIRECTORY = "/images/published/"

// Works for:
// https://docs.google.com/document/d/abcd1234
// https://docs.google.com/document/d/abcd1234/
// https://docs.google.com/document/d/abcd1234/edit
// https://docs.google.com/document/d/abcd-1234/edit
// https://docs.google.com/document/u/0/d/abcd-1234/edit
// https://docs.google.com/document/u/0/d/abcd-1234/edit?usp=sharing
export const gdocUrlRegex =
    /https:\/\/docs\.google\.com\/.+?\/d\/([-\w]+)\/?(edit)?#?/

// Works for:
// #dod:text
// #dod:text-hyphenated
// #dod:text_underscored
// #dod:text_underscored-and-hyphenated
// Duplicated in parser.ts
export const detailOnDemandRegex = /#dod:([\w\-_]+)/

export function getLinkType(urlString: string): OwidGdocLinkJSON["linkType"] {
    const url = Url.fromURL(urlString)
    if (url.isGoogleDoc) {
        return "gdoc"
    }
    if (url.isGrapher) {
        return "grapher"
    }
    if (url.isExplorer) {
        return "explorer"
    }
    return "url"
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
