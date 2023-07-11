import React from "react"
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer"
import { stringify } from "safe-stable-stringify"
import { omit, OwidGdocInterface } from "@ourworldindata/utils"

// Non-deterministic values which shouldn't be displayed in the diff viewer
// Errors are already shown in the settings drawer, so we don't show those either
export const GDOC_DIFF_OMITTABLE_PROPERTIES = [
    "errors",
    "imageMetadata",
    "linkedCharts",
    "linkedDocuments",
    "relatedCharts",
]

export const GdocsDiff = ({
    originalGdoc,
    currentGdoc,
}: {
    originalGdoc: OwidGdocInterface | undefined
    currentGdoc: OwidGdocInterface
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
