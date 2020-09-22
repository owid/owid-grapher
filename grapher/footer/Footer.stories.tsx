import * as React from "react"
import { Footer } from "grapher/footer/Footer"
import { FooterOptionsProvider } from "./FooterOptionsProvider"

export default {
    title: "Footer",
    component: Footer,
}

const options: FooterOptionsProvider = {
    originUrlWithProtocol: "https://localhost",
    note: "This is a note",
    sourcesLine: "These are my sources",
}

export const Default = () => <Footer options={options} />
