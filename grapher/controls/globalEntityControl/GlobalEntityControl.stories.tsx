import * as React from "react"
import { GlobalEntityControl } from "./GlobalEntityControl"
import { GlobalEntitySelection } from "./GlobalEntitySelection"

export default {
    title: "GlobalEntityControl",
    component: GlobalEntityControl,
}

export const WithNoGraphers = () => {
    const selection = new GlobalEntitySelection()
    return <GlobalEntityControl globalEntitySelection={selection} />
}
