import { hydrateRoot } from "react-dom/client"
import { CodeSnippet } from "./CodeSnippet.js"

export function hydrateCodeSnippets() {
    const codeSnippets = document.querySelectorAll("div.wp-code-snippet")
    codeSnippets.forEach((snippet) => {
        const code =
            snippet.querySelector(".wp-block-code code")?.textContent || ""

        if (!snippet.parentElement) return
        hydrateRoot(snippet.parentElement, <CodeSnippet code={code} />)
    })
}
