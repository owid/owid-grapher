import {
    OwidGdoc,
    OwidGdocPostContent,
    OwidGdocPostInterface,
    isEqual,
    omit,
} from "@ourworldindata/utils"
import { GDOC_DIFF_OMITTABLE_PROPERTIES } from "./GdocsDiff.js"
import { GDOCS_DETAILS_ON_DEMAND_ID } from "../settings/clientSettings.js"

export const checkFullDeployFallback = (
    prevGdoc: OwidGdocPostInterface,
    nextGdoc: OwidGdocPostInterface,
    hasChanges: boolean
) => {
    return hasChanges && (prevGdoc.published || nextGdoc.published)
}

/**
 * This function checks if the article has changed in a way that is compatible
 * with a lightning update. It does this by excluding certain props ("lightning
 * props") from the comparison. If nothing has changed except for the lightning
 * props, then it is safe to do a lightning update.
 *
 */
export const checkIsLightningUpdate = (
    prevGdoc: OwidGdocPostInterface,
    nextGdoc: OwidGdocPostInterface,
    hasChanges: boolean
) => {
    // lightning props are props that do not require a full rebake of the site if changed, because
    // their impact is limited to just this article. They are marked as "true" in these two config maps.
    // The props that *do* require a full rebake if changed are marked "false".
    const lightningPropConfigMap: Record<
        Exclude<keyof OwidGdocPostInterface, "content">,
        boolean
    > = {
        breadcrumbs: true,
        errors: true,
        linkedCharts: true,
        linkedDocuments: true,
        relatedCharts: true,
        revisionId: true,
        // "tags" is not actually a lightning prop, as it requires rebaking other parts of the site,
        // but they're set via the /setTags route and so should be ignored here
        tags: true,
        updatedAt: true,
        createdAt: false,
        id: false, // weird case - can't be updated
        imageMetadata: false, // could require baking new images
        publicationContext: false, // requires an update of the blog roll
        published: false, // requires an update of the blog roll
        publishedAt: false, // could require an update of the blog roll
        slug: false, // requires updating any articles that link to it
    }

    const lightningPropContentConfigMap: Record<
        keyof OwidGdocPostContent,
        boolean
    > = {
        "cover-color": true,
        "cover-image": true,
        "hide-citation": true,
        "sidebar-toc": true,
        body: true,
        dateline: true,
        details: true,
        refs: true,
        subtitle: true,
        summary: true,
        "sticky-nav": true,
        supertitle: true,
        toc: true,
        "atom-excerpt": false, // requires updating the atom feed / blog roll
        "atom-title": false, // requires updating the atom feed / blog roll
        "featured-image": false, // requires updating references to this article
        authors: false, // requires updating references to this article
        excerpt: false, // requires updating references to this article
        faqs: false, // requires updating datapages
        parsedFaqs: false, // requires updating datapages
        title: false, // requires updating references to this article
        type: false, // could require updating other content if switching type to fragment
    }

    const getLightningPropKeys = (configMap: Record<string, boolean>) =>
        Object.entries(configMap)
            .filter(([_, isLightningProp]) => isLightningProp)
            .map(([key]) => key)

    const lightningPropKeys = getLightningPropKeys(lightningPropConfigMap)
    const lightningPropContentKeys = getLightningPropKeys(
        lightningPropContentConfigMap
    )

    const keysToOmit = [
        ...lightningPropKeys,
        ...lightningPropContentKeys.map((key) => `content.${key}`),
    ]

    // When this function is called from server-side code and a Gdoc object
    // is passed in, the omit() call will surface Gdoc class members. The
    // comparison will then fail if the other operand in the comparison is
    // an OwidGdocPostInterface object. To avoid this, we spread into new objects
    // in order to compare the same types.
    const prevOmitted = omit({ ...prevGdoc }, keysToOmit)
    const nextOmitted = omit({ ...nextGdoc }, keysToOmit)

    return (
        prevGdoc.id !== GDOCS_DETAILS_ON_DEMAND_ID &&
        hasChanges &&
        prevGdoc.published &&
        nextGdoc.published &&
        isEqual(prevOmitted, nextOmitted)
    )
}

export const checkHasChanges = (prevGdoc: OwidGdoc, nextGdoc: OwidGdoc) =>
    !isEqual(
        omit(
            {
                ...prevGdoc,
                tags: prevGdoc.tags?.map((tag) => JSON.stringify(tag)),
            },
            GDOC_DIFF_OMITTABLE_PROPERTIES
        ),
        omit(
            {
                ...nextGdoc,
                tags: nextGdoc.tags?.map((tag) => JSON.stringify(tag)),
            },
            GDOC_DIFF_OMITTABLE_PROPERTIES
        )
    )
