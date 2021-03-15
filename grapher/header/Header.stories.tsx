import * as React from "react"
import { Header } from "./Header"
import { HeaderManager } from "./HeaderManager"

export default {
    title: "Header",
    component: Header,
}

const manager: HeaderManager = {
    currentTitle: "Hello world",
    subtitle: "This is my chart subtitle",
}

export const Default = () => <Header manager={manager} />
