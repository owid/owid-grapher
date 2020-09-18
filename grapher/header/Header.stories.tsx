import * as React from "react"
import { Header } from "./Header"
import { HeaderOptionsProvider } from "./HeaderOptionsProvider"

export default {
    title: "Header",
    component: Header,
    argTypes: {
        maxWidth: {
            control: { type: "range", min: 1, max: 2000 },
            defaultValue: 400,
        },
    },
}

const options: HeaderOptionsProvider = {
    currentTitle: "Hello world",
    subtitle: "This is my chart subtitle",
}

export const Default = (args: any) => {
    return <Header maxWidth={args.maxWidth ?? 400} options={options} />
}
