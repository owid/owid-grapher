import { OwidGdocLinkJSON } from "./owidTypes.js"

// Works for:
// https://docs.google.com/document/d/abcd1234/edit
// https://docs.google.com/document/d/abcd-1234/edit
// https://docs.google.com/document/u/0/d/abcd-1234/edit
// https://docs.google.com/document/u/0/d/abcd-1234/edit?usp=sharing
export const gdocUrlRegex = /https:\/\/docs\.google\.com\/.+?\/([-\w]+)\/edit/

// Works for:

export const detailOnDemandRegex = /#dod:([\w\-_]+)$/g

export function getLinkType(url: string): OwidGdocLinkJSON["linkType"] {
    if (url.match(gdocUrlRegex)) {
        return "gdoc"
    }
    return "url"
}

export function checkIsInternalLink(url: string): boolean {
    if (getLinkType(url) === "gdoc") return true
    // TODO: if (getLinkType(url) === 'grapher') return true etc..
    return false
}

export function getUrlTarget(url: string): string {
    const gdocsMatch = url.match(gdocUrlRegex)
    if (gdocsMatch) {
        const [_, gdocId] = gdocsMatch
        return gdocId
    }
    return url
}
