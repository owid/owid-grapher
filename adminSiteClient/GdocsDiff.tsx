import React from "react"
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer"
import { stringify } from "safe-stable-stringify"
import { omit, OwidDocument } from "@ourworldindata/utils"

export const GdocsDiff = ({
    originalGdoc,
    currentGdoc,
}: {
    originalGdoc: OwidDocument | undefined
    currentGdoc: OwidDocument
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
