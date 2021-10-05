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
    // It is more desirable to temporarily deploy with citation overrides
    // absent, while fixing the issue.
    const landing = await getPostBySlugLogToSlackNoThrow(landingSlug)
    if (!landing) {
        // todo: the concept of "citation overrides" does not belong to that
        // generic function. Logging this message should be the responsibility
        // of the caller function.
        logErrorAndMaybeSendToSlack(
            new Error(
                `Citation overrides not applied for ${post.slug}. Please check the href of the "subnavs[${formattingOptions.subnavId}]" landing page (the first item in the array): it is likely out-of-date and is being redirected.`
            )
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
