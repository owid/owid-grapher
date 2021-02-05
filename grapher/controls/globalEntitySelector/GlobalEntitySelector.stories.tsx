import * as React from "react"
import { SelectionArray } from "../../selection/SelectionArray"
import { GlobalEntitySelector } from "./GlobalEntitySelector"

export default {
    title: "GlobalEntityControl",
    component: GlobalEntitySelector,
}

export const WithNoGraphers = () => (
    <GlobalEntitySelector selection={new SelectionArray()} />
)
