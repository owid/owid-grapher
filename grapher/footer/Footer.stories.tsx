import * as React from "react"
import { Footer } from "grapher/footer/Footer"
import { FooterOptionsProvider } from "./FooterOptionsProvider"

export default {
    title: "Footer",
    component: Footer,
    argTypes: {
        maxWidth: {
            control: { type: "range", min: 1, max: 2000 },
            defaultValue: 400,
        },
    },
}

const options: FooterOptionsProvider = {
    originUrlWithProtocol: "https://localhost",
    note: "This is a note",
    sourcesLine: "These are my sources",
}

export const Default = (args: any) => {
    return <Footer maxWidth={args.maxWidth ?? 400} options={options} />
}
