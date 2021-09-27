import { PageOverrides } from "../site/LongFormPage"
import { BAKED_BASE_URL } from "../settings/serverSettings"
import { stringifyUnkownError, urlToSlug } from "../clientUtils/Util"
import { FormattingOptions, FullPost } from "../clientUtils/owidTypes"
import { getPostBySlug, isPostCitable } from "../db/wpdb"
import { getTopSubnavigationParentItem } from "../site/SiteSubnavigation"
import { logErrorAndMaybeSendToSlack } from "./slackLog"

export const getPostBySlugLogToSlackNoThrow = async (slug: string) => {
    let post
    try {
        post = await getPostBySlug(slug)
    } catch (err) {
        logErrorAndMaybeSendToSlack(stringifyUnkownError(err))
    } finally {
        return post
    }
}

export const getLandingOnlyIfParent = async (
    post: FullPost,
    formattingOptions: FormattingOptions
) => {
    if (!formattingOptions.subnavId) return

    const landingItemHref = getTopSubnavigationParentItem(
        formattingOptions.subnavId
    )?.href
    if (!landingItemHref) return

    const landingSlug = urlToSlug(landingItemHref)
    if (landingSlug === post.slug) return

    // Using no-throw version to prevent throwing and stopping baking mid-way.
    // Since deploying steps are independent, throwing would result in baking
    // the site up to that point, and running a deploy of that half-baked
    // version. It is more desirable to deploy a more consistent version, where
    // citation overrides are absent, but the rest keeps updating.
    const landing = await getPostBySlugLogToSlackNoThrow(landingSlug)
    if (!landing) {
        logErrorAndMaybeSendToSlack(
            `Warning: The href of the first item of the "subnavs[${formattingOptions.subnavId}]" array (the landing page) is likely out-of-date and is being redirected. Please update to avoid unnecessary and SEO damaging internal redirects.`
        )
    }

    return landing
}

export const getPageOverrides = async (
    post: FullPost,
    formattingOptions: FormattingOptions
): Promise<PageOverrides | undefined> => {
    const landing = await getLandingOnlyIfParent(post, formattingOptions)
    if (!landing) return

    const isParentLandingCitable = await isPostCitable(landing)
    if (!isParentLandingCitable) return

    return {
        citationTitle: landing.title,
        citationSlug: landing.slug,
        citationCanonicalUrl: `${BAKED_BASE_URL}/${landing.slug}`,
        citationAuthors: landing.authors,
        citationPublicationDate: landing.date,
    }
}

export const isPageOverridesCitable = (pageOverrides?: PageOverrides) => {
    if (!pageOverrides) return false

    return (
        !!pageOverrides.citationTitle &&
        !!pageOverrides.citationSlug &&
        !!pageOverrides.citationCanonicalUrl &&
        !!pageOverrides.citationAuthors &&
        !!pageOverrides.citationPublicationDate
    )
}
