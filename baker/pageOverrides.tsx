import { PageOverrides } from "../site/LongFormPage.js"
import { BAKED_BASE_URL } from "../settings/serverSettings.js"
import { urlToSlug, JsonError } from "@ourworldindata/utils"
import { FormattingOptions, DbEnrichedPost } from "@ourworldindata/types"
import { getFullPost, isPostCitable } from "../db/wpdb.js"
import { getTopSubnavigationParentItem } from "../site/SiteSubnavigation.js"
import { logErrorAndMaybeSendToBugsnag } from "../serverUtils/errorLog.js"
import { getPostEnrichedBySlug } from "../db/model/Post.js"

export const getLandingOnlyIfParent = async (
    slug: string,
    formattingOptions: FormattingOptions
): Promise<DbEnrichedPost | undefined> => {
    if (!formattingOptions.subnavId) return

    const landingItemHref = getTopSubnavigationParentItem(
        formattingOptions.subnavId
    )?.href
    if (!landingItemHref) return

    const landingSlug = urlToSlug(landingItemHref)
    if (landingSlug === slug) return

    const landing = await getPostEnrichedBySlug(landingSlug)
    // Continue baking even if a landing page is not found. It is more desirable
    // to temporarily deploy with citation overrides absent, than throw and halt
    // baking.
    if (!landing) {
        // todo: the concept of "citation overrides" does not belong to that
        // generic function. Logging this message should be the responsibility
        // of the caller function.
        logErrorAndMaybeSendToBugsnag(
            new JsonError(
                // This error often shows up intermittently as a false-positive (DB unavailable when calling getPostBySlug()?)
                // If it happens systematically, please check
                // the href of the "subnavs[${formattingOptions.subnavId}]"
                // landing page (the first item in the array): it might be
                // out-of-date and redirected.
                `Landing page not found. Citation overrides not applied for ${slug}. This might be an intermittent issue.`
            )
        )
    }

    return landing
}

export const getPageOverrides = async (
    slug: string,
    formattingOptions: FormattingOptions
): Promise<PageOverrides | undefined> => {
    const landingEnriched = await getLandingOnlyIfParent(
        slug,
        formattingOptions
    )
    if (!landingEnriched) return

    const landing = await getFullPost(landingEnriched)
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
