import * as React from "react"
import { SelectionArray } from "../../selection/SelectionArray"
import { GlobalEntityControl } from "./GlobalEntityControl"

export default {
    title: "GlobalEntityControl",
    component: GlobalEntityControl,
}

export const WithNoGraphers = () => (
    <GlobalEntityControl selection={new SelectionArray()} />
)
