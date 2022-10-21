import {
    OwidArticleContent,
    OwidArticleType,
    isEqual,
    omit,
} from "@ourworldindata/utils"

export const checkFullDeployFallback = (
    prevGdoc: OwidArticleType,
    nextGdoc: OwidArticleType,
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
    prevGdoc: OwidArticleType,
    nextGdoc: OwidArticleType,
    hasChanges: boolean
) => {
    const lightningArticleProps: Array<keyof OwidArticleType> = ["updatedAt"]

    const lightningContentProps: Array<keyof OwidArticleContent> = [
        "body",
        "subtitle",
        "refs",
        "summary",
        "citation",
        "cover-image",
    ]

    const lightningProps = [
        ...lightningArticleProps,
        ...lightningContentProps.map((prop) => `content.${prop}`),
    ]

    return (
        hasChanges &&
        prevGdoc.published &&
        nextGdoc.published &&
        // When this function is called from server-side code and a Gdoc object
        // is passed in, the omit() call will surface Gdoc class members. The
        // comparison will then fail if the other operand in the comparison is
        // an OwidArticleType object. To avoid this, we spread into new objects
        // in order to compare the same types.
        isEqual(
            omit({ ...prevGdoc }, lightningProps),
            omit({ ...nextGdoc }, lightningProps)
        )
    )
}

export const checkHasChanges = (
    prevGdoc: OwidArticleType,
    nextGdoc: OwidArticleType
) => !isEqual(prevGdoc, nextGdoc)
