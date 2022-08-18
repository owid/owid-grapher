import React, { useState } from "react"
import classnames from "classnames"
import ReactDOM from "react-dom"
import ReactDOMServer from "react-dom/server.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCopy } from "@fortawesome/free-solid-svg-icons/faCopy"
import { delay } from "../../clientUtils/Util.js"

export const CodeSnippet = (props: { code: string }) => {
    const [hasCopied, setHasCopied] = useState(false)

    const copy = () => {
        try {
            navigator.clipboard.writeText(props.code)
            setHasCopied(true)
            // reset CSS animation
            delay(() => setHasCopied(false), 500)
        } catch (err) {
            console.error(
                "Couldn't copy to clipboard using navigator.clipboard",
                err
            )
        }
    }

    return (
        <div className="wp-code-snippet">
            <pre className="wp-block-code">
                <code>{props.code}</code>
            </pre>
            <button
                className={classnames("code-copy-button", {
                    "code-copy-button--has-copied": hasCopied,
                })}
                onClick={copy}
                aria-label="Copy to clipboard"
            >
                <FontAwesomeIcon icon={faCopy} />
            </button>
        </div>
    )
}

export const hydrateCodeSnippets = () => {
    const codeSnippets = document.querySelectorAll("div.wp-code-snippet")

    codeSnippets.forEach((snippet) => {
        const code =
            snippet.querySelector(".wp-block-code code")?.textContent || ""
        ReactDOM.hydrate(<CodeSnippet code={code} />, snippet.parentElement)
    })
}

export const renderCodeSnippets = ($: CheerioStatic) => {
    const codeSnippets = $("div.wp-code-snippet")
    codeSnippets.each((_, snippet) => {
        const $el = $(snippet)
        const $dry = $(
            ReactDOMServer.renderToStaticMarkup(
                <div>
                    <CodeSnippet code={$el.text().trim()} />
                </div>
            )
        )
        $el.after($dry)
        $el.remove()
    })
}
