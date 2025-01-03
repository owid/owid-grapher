import { renderToStaticMarkup } from "react-dom/server"
import { CodeSnippet } from "./CodeSnippet.js"

export function renderCodeSnippets($: CheerioStatic) {
    const codeSnippets = $("div.wp-code-snippet")
    codeSnippets.each((_, snippet) => {
        const $el = $(snippet)
        const $dry = $(
            renderToStaticMarkup(
                <div>
                    <CodeSnippet code={$el.text().trim()} />
                </div>
            )
        )
        $el.after($dry)
        $el.remove()
    })
}
