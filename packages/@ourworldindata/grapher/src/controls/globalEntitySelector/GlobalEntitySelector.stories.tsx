import * as React from "react"
import { SelectionArray } from "../../selection/SelectionArray"
import { GlobalEntitySelector } from "./GlobalEntitySelector"

export default {
    title: "GlobalEntitySelector",
    component: GlobalEntitySelector,
}

export const WithNoGraphers = (): React.ReactElement => (
    <GlobalEntitySelector selection={new SelectionArray()} />
)
