import {
    OwidGdocContent,
    OwidGdocInterface,
    isEqual,
    omit,
} from "@ourworldindata/utils"

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

    return (
        hasChanges &&
        prevGdoc.published &&
        nextGdoc.published &&
        // When this function is called from server-side code and a Gdoc object
        // is passed in, the omit() call will surface Gdoc class members. The
        // comparison will then fail if the other operand in the comparison is
        // an OwidGdocInterface object. To avoid this, we spread into new objects
        // in order to compare the same types.
        isEqual(
            omit({ ...prevGdoc }, lightningProps),
            omit({ ...nextGdoc }, lightningProps)
        )
    )
}

export const checkHasChanges = (
    prevGdoc: OwidGdocInterface,
    nextGdoc: OwidGdocInterface
) =>
    !isEqual(
        // Ignore non-deterministic attachments
        omit(prevGdoc, [
            "linkedDocuments",
            "imageMetadata",
            "linkedCharts",
            "errors",
        ]),
        omit(nextGdoc, [
            "linkedDocuments",
            "imageMetadata",
            "linkedCharts",
            "errors",
        ])
    )
