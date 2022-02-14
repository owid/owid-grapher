import * as React from "react"
import { Header } from "./Header.js"
import { HeaderManager } from "./HeaderManager.js"

export default {
    title: "Header",
    component: Header,
}

const manager: HeaderManager = {
    currentTitle: "Hello world",
    subtitle: "This is my chart subtitle",
}

export const Default = (): JSX.Element => <Header manager={manager} />
