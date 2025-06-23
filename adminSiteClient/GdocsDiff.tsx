import * as _ from "lodash-es"
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued"
import { stringify } from "safe-stable-stringify"
import { OwidGdoc } from "@ourworldindata/utils"
import { GDOC_DIFF_OMITTABLE_PROPERTIES } from "./constants.js"

export const GdocsDiff = ({
    originalGdoc,
    currentGdoc,
}: {
    originalGdoc: OwidGdoc | undefined
    currentGdoc: OwidGdoc
}) => (
    <ReactDiffViewer
        oldValue={stringify(
            _.omit(originalGdoc, GDOC_DIFF_OMITTABLE_PROPERTIES),
            null,
            2
        )}
        newValue={stringify(
            _.omit(currentGdoc, GDOC_DIFF_OMITTABLE_PROPERTIES),
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
