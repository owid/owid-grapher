import * as React from "react"
import { Footer } from "grapher/footer/Footer"
import { FooterManager } from "./FooterManager"

export default {
    title: "Footer",
    component: Footer,
}

const manager: FooterManager = {
    originUrlWithProtocol: "https://localhost",
    note: "This is a note",
    sourcesLine: "These are my sources",
}

export const Default = () => <Footer manager={manager} />
