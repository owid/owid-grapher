import * as React from "react"
import { Header } from "./Header"
import { HeaderOptionsProvider } from "./HeaderOptionsProvider"

export default {
    title: "Header",
    component: Header,
}

const options: HeaderOptionsProvider = {
    currentTitle: "Hello world",
    subtitle: "This is my chart subtitle",
}

export const Default = () => <Header options={options} />
