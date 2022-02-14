import * as React from "react"
import { CollapsibleList, MoreButton } from "./CollapsibleList.js"
import { collapsibleListSampleItems } from "./CollapsibleList.sampleInput.js"

export default {
    title: "CollapsibleList",
    component: CollapsibleList,
}

export const CollapsibleListComponent = (): JSX.Element => {
    return <CollapsibleList>{collapsibleListSampleItems}</CollapsibleList>
}

export const MoreButtonComponent = (): JSX.Element => {
    const options = [
        <div key="option1">option1</div>,
        <div key="option2">option2</div>,
        <div key="option3">option3</div>,
    ]

    return <MoreButton options={options} />
}
