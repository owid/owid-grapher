import {
    OwidGdocContent,
    OwidGdocInterface,
    isEqual,
    omit,
} from "@ourworldindata/utils"
import { GDOC_DIFF_OMITTABLE_PROPERTIES } from "./GdocsDiff.js"

export const checkFullDeployFallback = (
    prevGdoc: OwidGdocInterface,
    nextGdoc: OwidGdocInterface,
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
    prevGdoc: OwidGdocInterface,
    nextGdoc: OwidGdocInterface,
    hasChanges: boolean
) => {
    const lightningArticleProps: Array<keyof OwidGdocInterface> = [
        "updatedAt",
        "linkedDocuments",
        "imageMetadata",
        "linkedCharts",
        "errors",
        "revisionId",
    ]

    const lightningContentProps: Array<keyof OwidGdocContent> = [
        "body",
        "subtitle",
        "toc",
        "supertitle",
        "refs",
        "summary",
        "cover-image",
        "cover-color",
    ]

    const lightningProps = [
        ...lightningArticleProps,
        ...lightningContentProps.map((prop) => `content.${prop}`),
    ]

    // When this function is called from server-side code and a Gdoc object
    // is passed in, the omit() call will surface Gdoc class members. The
    // comparison will then fail if the other operand in the comparison is
    // an OwidGdocInterface object. To avoid this, we spread into new objects
    // in order to compare the same types. Tags are stringified to avoid a similar
    // issue with Dates and date strings.
    const prevOmitted = omit(
        { ...prevGdoc, tags: nextGdoc.tags?.map((tag) => JSON.stringify(tag)) },
        lightningProps
    )
    const nextOmitted = omit(
        { ...nextGdoc, tags: prevGdoc.tags?.map((tag) => JSON.stringify(tag)) },
        lightningProps
    )

    return (
        hasChanges &&
        prevGdoc.published &&
        nextGdoc.published &&
        isEqual(prevOmitted, nextOmitted)
    )
}

export const checkHasChanges = (
    prevGdoc: OwidGdocInterface,
    nextGdoc: OwidGdocInterface
) =>
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
