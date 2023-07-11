import React from "react"
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer"
import { stringify } from "safe-stable-stringify"
import { omit, OwidGdocInterface } from "@ourworldindata/utils"

export const GdocsDiff = ({
    originalGdoc,
    currentGdoc,
}: {
    originalGdoc: OwidGdocInterface | undefined
    currentGdoc: OwidGdocInterface
}) => (
    <ReactDiffViewer
        oldValue={stringify(
            omit(originalGdoc, [
                "errors",
                "imageMetadata",
                "linkedCharts",
                "linkedDocuments",
                "relatedCharts",
            ]),
            null,
            2
        )}
        newValue={stringify(
            omit(currentGdoc, [
                "errors",
                "imageMetadata",
                "linkedCharts",
                "linkedDocuments",
                "relatedCharts",
            ]),
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
