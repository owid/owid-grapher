import React from "react"
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer"
import { stringify } from "safe-stable-stringify"
import { OwidArticleType } from "../clientUtils/owidTypes.js"

export const GdocsDiff = ({
    originalGdoc,
    gdoc,
}: {
    originalGdoc: OwidArticleType | undefined
    gdoc: OwidArticleType
}) => (
    <ReactDiffViewer
        oldValue={stringify(originalGdoc, null, 2)}
        newValue={stringify(gdoc, null, 2)}
        compareMethod={DiffMethod.WORDS}
        styles={{
            contentText: {
                wordBreak: "break-word",
            },
        }}
        onLineNumberClick={(lineNumber) => {
            console.log(lineNumber)
        }}
    />
)
