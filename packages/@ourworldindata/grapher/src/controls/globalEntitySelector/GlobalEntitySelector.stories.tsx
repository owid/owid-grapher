import React from "react"
import { SelectionArray } from "../../selection/SelectionArray.js"
import { GlobalEntitySelector } from "./GlobalEntitySelector.js"

export default {
    title: "GlobalEntitySelector",
    component: GlobalEntitySelector,
}

export const WithNoGraphers = (): JSX.Element => (
    <GlobalEntitySelector selection={new SelectionArray()} />
)
