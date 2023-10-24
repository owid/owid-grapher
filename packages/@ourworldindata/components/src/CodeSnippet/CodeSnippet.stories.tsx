import React from "react"
import { CodeSnippet } from "./CodeSnippet.js"

export default {
    title: "CodeSnippet",
    component: CodeSnippet,
}

const code = `Some very impressive code.
It's even multiline!`

export const Default = (): JSX.Element => <CodeSnippet code={code} />
