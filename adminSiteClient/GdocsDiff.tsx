import React from "react"
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer"
import { stringify } from "safe-stable-stringify"
import { omit, OwidDocumentInterface } from "@ourworldindata/utils"

export const GdocsDiff = ({
    originalGdoc,
    currentGdoc,
}: {
    originalGdoc: OwidDocumentInterface | undefined
    currentGdoc: OwidDocumentInterface
}) => (
    <ReactDiffViewer
        oldValue={stringify(
            omit(originalGdoc, ["linkedDocuments", "imageMetadata", "errors"]),
            null,
            2
        )}
        newValue={stringify(
            omit(currentGdoc, ["linkedDocuments", "imageMetadata", "errors"]),
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
