import * as React from "react"
import { CollapsibleList, MoreButton } from "./CollapsibleList"
import { collapsibleListSampleItems } from "./CollapsibleList.sampleInput"

export default {
    title: "CollapsibleList",
    component: CollapsibleList,
}

export const CollapsibleListComponent = () => {
    return <CollapsibleList>{collapsibleListSampleItems}</CollapsibleList>
}

export const MoreButtonComponent = () => {
    const options = [
        <div key="option1">option1</div>,
        <div key="option2">option2</div>,
        <div key="option3">option3</div>,
    ]

    return <MoreButton options={options} />
}
