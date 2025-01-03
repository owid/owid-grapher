import { hydrate } from "react-dom"
import { CodeSnippet } from "./CodeSnippet.js"

export function hydrateCodeSnippets() {
    const codeSnippets = document.querySelectorAll("div.wp-code-snippet")
    codeSnippets.forEach((snippet) => {
        const code =
            snippet.querySelector(".wp-block-code code")?.textContent || ""
        hydrate(<CodeSnippet code={code} />, snippet.parentElement)
    })
}
