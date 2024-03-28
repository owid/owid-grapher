import { isEqual, omit } from "@ourworldindata/utils"
import {
    OwidGdoc,
    OwidGdocBaseInterface,
    OwidGdocPostContent,
    OwidGdocDataInsightContent,
    OwidGdocType,
    OwidGdocHomepageContent,
    DbEnrichedPostGdoc,
    OwidGdocAuthorContent,
} from "@ourworldindata/types"
import { GDOC_DIFF_OMITTABLE_PROPERTIES } from "./GdocsDiff.js"
import { GDOCS_DETAILS_ON_DEMAND_ID } from "../settings/clientSettings.js"

export const checkFullDeployFallback = (
    prevGdoc: DbEnrichedPostGdoc,
    nextGdoc: DbEnrichedPostGdoc,
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
    prevGdoc: OwidGdoc,
    nextGdoc: OwidGdoc,
    hasChanges: boolean
) => {
    if (
        prevGdoc.content.type !== nextGdoc.content.type ||
        prevGdoc.id === GDOCS_DETAILS_ON_DEMAND_ID ||
        !hasChanges ||
        !prevGdoc.published ||
        !nextGdoc.published
    ) {
        return false
    }

    const gdocType = nextGdoc.content.type as OwidGdocType

    // lightning props are props that do not require a full rebake of the site if changed, because
    // their impact is limited to just this article. They are marked as "true" in these two config maps.
    // The props that *do* require a full rebake if changed are marked "false".
    const baseLightningPropConfigMap: Record<
        Exclude<keyof OwidGdocBaseInterface, "content">,
        boolean
    > = {
        breadcrumbs: true,
        errors: true,
        linkedCharts: true,
        linkedIndicators: true,
        linkedDocuments: true,
        relatedCharts: true,
        revisionId: true,
        updatedAt: true,
        markdown: true,
        createdAt: false, // weird case - can't be updated
        id: false, // weird case - can't be updated
        tags: false, // could require updating datapages, though it's currently not possible to have a difference between prevGdoc.tags and nextGdoc.tags
        imageMetadata: false, // could require baking new images
        publicationContext: false, // requires an update of the blog roll
        published: false, // requires an update of the blog roll
        publishedAt: false, // could require an update of the blog roll
        slug: false, // requires updating any articles that link to it
    }

    const postlightningPropContentConfigMap: Record<
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

    const dataInsightLightningPropContentConfigMap: Record<
        keyof OwidGdocDataInsightContent,
        boolean
    > = {
        ["grapher-url"]: true,
        ["approved-by"]: true,
        title: false, // requires rebaking the feed
        authors: false, // requires rebaking the feed
        body: false, // requires rebaking the feed
        type: false, // shouldn't be changed, but would require rebaking the feed if it was
    }
    const homepageLightningPropContentConfigMap: Record<
        keyof OwidGdocHomepageContent,
        boolean
    > = {
        body: true,
        title: false, // shouldn't be changed, but won't be used in the baked page anyway
        authors: false, // shouldn't be set, but defaults to "Our World in Data" because it's assumed to exist in the DB
        type: false, // should never be changed
    }

    const authorLightningPropContentConfigMap: Record<
        keyof OwidGdocAuthorContent,
        boolean
    > = {
        type: false, // shouldn't change
        title: false, // assumed to be used in "author cards" throughout the site
        role: false, // assumed to be used in "author cards" throughout the site
        bio: false, // assumed to be used in "author cards" throughout the site
        "featured-image": false, // assumed to be used in "author cards" throughout the site
        authors: true, // not used
        socials: false, // assumed to be used in "author cards" throughout the site
        body: true, // probably not used outside of the author page, if at all
    }

    const contentPropsMap: Record<OwidGdocType, Record<string, boolean>> = {
        [OwidGdocType.Article]: postlightningPropContentConfigMap,
        [OwidGdocType.Fragment]: postlightningPropContentConfigMap,
        [OwidGdocType.LinearTopicPage]: postlightningPropContentConfigMap,
        [OwidGdocType.TopicPage]: postlightningPropContentConfigMap,
        [OwidGdocType.DataInsight]: dataInsightLightningPropContentConfigMap,
        [OwidGdocType.Homepage]: homepageLightningPropContentConfigMap,
        [OwidGdocType.AboutPage]: postlightningPropContentConfigMap,
        [OwidGdocType.Author]: authorLightningPropContentConfigMap,
    }

    const getLightningPropKeys = (configMap: Record<string, boolean>) =>
        Object.entries(configMap)
            .filter(([_, isLightningProp]) => isLightningProp)
            .map(([key]) => key)

    const lightningPropKeys = getLightningPropKeys(baseLightningPropConfigMap)

    const lightningPropContentKeys = getLightningPropKeys(
        contentPropsMap[gdocType]
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

    return isEqual(prevOmitted, nextOmitted)
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

export enum GdocPublishingAction {
    Updating = "Updating",
    Publishing = "Publishing",
    Unpublishing = "Unpublishing",
}

export function getPublishingAction(
    prevJson: OwidGdoc,
    nextJson: OwidGdoc
): GdocPublishingAction {
    return prevJson.published && nextJson.published
        ? GdocPublishingAction.Updating
        : !prevJson.published && nextJson.published
          ? GdocPublishingAction.Publishing
          : GdocPublishingAction.Unpublishing
}
