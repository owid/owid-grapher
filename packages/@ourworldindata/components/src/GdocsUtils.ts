import { OwidGdoc, OwidGdocLinkType, OwidGdocType } from "@ourworldindata/types"
import {
    spansToUnformattedPlainText,
    gdocUrlRegex,
    Span,
    Url,
} from "@ourworldindata/utils"
import urlSlug from "url-slug"
import { P, match } from "ts-pattern"

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

export function getCanonicalUrl(baseUrl: string, gdoc: OwidGdoc): string {
    return match(gdoc)
        .with(
            {
                content: { type: OwidGdocType.Homepage },
            },
            () => baseUrl
        )
        .with(
            {
                content: {
                    type: P.union(
                        OwidGdocType.Article,
                        OwidGdocType.TopicPage,
                        OwidGdocType.LinearTopicPage,
                        OwidGdocType.AboutPage
                    ),
                },
            },
            () => `${baseUrl}/${gdoc.slug}`
        )
        .with(
            {
                content: { type: OwidGdocType.DataInsight },
            },
            () => `${baseUrl}/data-insights/${gdoc.slug}`
        )
        .with(
            {
                content: { type: P.union(OwidGdocType.Fragment, undefined) },
            },
            () => ""
        )
        .exhaustive()
}

export function getPageTitle(gdoc: OwidGdoc) {
    return match(gdoc)
        .with(
            {
                content: {
                    type: OwidGdocType.Homepage,
                },
            },
            // <Head> uses the default title of "Our World in Data" when pageTitle is undefined
            // Otherwise we'd get " - Our World in Data" appended to whatever title we return here
            () => undefined
        )
        .with(
            {
                content: {
                    type: P.union(
                        OwidGdocType.Article,
                        OwidGdocType.TopicPage,
                        OwidGdocType.LinearTopicPage,
                        OwidGdocType.AboutPage,
                        OwidGdocType.DataInsight
                    ),
                },
            },
            (match) => match.content.title
        )
        .with(
            {
                content: {
                    type: P.union(OwidGdocType.Fragment, undefined),
                },
            },
            () => undefined
        )
        .exhaustive()
}
