import React from "react"
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer"
import { stringify } from "safe-stable-stringify"
import { omit, OwidGdocPostInterface } from "@ourworldindata/utils"

// Non-deterministic values which shouldn't be displayed in the diff viewer
// Errors are already shown in the settings drawer, so we don't show those either
export const GDOC_DIFF_OMITTABLE_PROPERTIES = [
    "errors",
    // imageMetadata *does* count as something that meaningfully contributes to whether a Gdoc is different,
    // And it's checked in the checkIsLightningUpdate function,
    // but for the preview, it's already captured by changes to the body text, so we don't need to show these objects in the diff also
    "imageMetadata",
    "linkedCharts",
    "linkedDocuments",
    "relatedCharts",
]

export const GdocsDiff = ({
    originalGdoc,
    currentGdoc,
}: {
    originalGdoc: OwidGdocPostInterface | undefined
    currentGdoc: OwidGdocPostInterface
}) => (
    <ReactDiffViewer
        oldValue={stringify(
            omit(originalGdoc, GDOC_DIFF_OMITTABLE_PROPERTIES),
            null,
            2
        )}
        newValue={stringify(
            omit(currentGdoc, GDOC_DIFF_OMITTABLE_PROPERTIES),
            null,
            2
        )}
        compareMethod={DiffMethod.WORDS}
        styles={{
            contentText: {
                wordBreak: "break-word",
            },
        }}
    />
)
