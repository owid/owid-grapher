import React from "react"
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer"
import { stringify } from "safe-stable-stringify"
import { omit, OwidArticleType } from "@ourworldindata/utils"

export const GdocsDiff = ({
    originalGdoc,
    currentGdoc,
}: {
    originalGdoc: OwidArticleType | undefined
    currentGdoc: OwidArticleType
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
