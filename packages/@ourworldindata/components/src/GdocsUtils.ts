import {
    OwidGdoc,
    ContentGraphLinkType,
    OwidGdocType,
} from "@ourworldindata/types"
import {
    spansToUnformattedPlainText,
    gdocUrlRegex,
    Span,
    Url,
    detailOnDemandRegex,
    guidedChartRegex,
} from "@ourworldindata/utils"
import urlSlug from "url-slug"
import { P, match } from "ts-pattern"

export function getLinkType(urlString: string): ContentGraphLinkType {
    const url = Url.fromURL(urlString)
    if (url.isGoogleDoc) {
        return ContentGraphLinkType.Gdoc
    }
    if (url.isGrapher) {
        return ContentGraphLinkType.Grapher
    }
    if (url.isExplorer) {
        return ContentGraphLinkType.Explorer
    }
    if (url.isDod) {
        return ContentGraphLinkType.Dod
    }
    if (url.isGuidedChart) {
        return ContentGraphLinkType.GuidedChart
    }
    return ContentGraphLinkType.Url
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
    if (url.isDod) {
        const dodMatch = urlString.match(detailOnDemandRegex)
        if (dodMatch) {
            const [_, dodId] = dodMatch
            return dodId
        }
    }
    if (url.isGuidedChart) {
        const guidedChartMatch = urlString.match(guidedChartRegex)
        if (guidedChartMatch) {
            const [_, guidedChartId] = guidedChartMatch
            return guidedChartId
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

export function getPrefixedGdocPath(
    prefix: string,
    gdoc: { slug: string; content: { type?: OwidGdocType } }
): string {
    return match(gdoc)
        .with(
            {
                content: { type: OwidGdocType.Homepage },
            },
            () => prefix
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
            () => `${prefix}/${gdoc.slug}`
        )
        .with(
            {
                content: { type: OwidGdocType.DataInsight },
            },
            () => `${prefix}/data-insights/${gdoc.slug}`
        )
        .with(
            {
                content: { type: OwidGdocType.Author },
            },
            () => `${prefix}/team/${gdoc.slug}`
        )
        .with(
            {
                content: { type: P.union(OwidGdocType.Fragment, undefined) },
            },
            () => ""
        )
        .exhaustive()
}

export const getBakePath = (
    bakedSiteDir: string,
    gdoc: { slug: string; content: { type?: OwidGdocType } }
): string => {
    return getPrefixedGdocPath(bakedSiteDir, gdoc)
}

export const getCanonicalUrl = (
    baseUrl: string,
    gdoc: { slug: string; content: { type?: OwidGdocType } }
): string => {
    return getPrefixedGdocPath(baseUrl, gdoc)
}

export const getCanonicalPath = (slug: string, type: OwidGdocType): string => {
    return getCanonicalUrl("", {
        slug,
        content: {
            type,
        },
    })
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
                        OwidGdocType.DataInsight,
                        OwidGdocType.Author
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
