import React, { useState } from "react"
import classnames from "classnames"
import ReactDOM from "react-dom"
import ReactDOMServer from "react-dom/server.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCopy } from "@fortawesome/free-solid-svg-icons/faCopy"
import { delay } from "../../clientUtils/Util.js"

export const CitationSnippet = (props: { code: string }) => {
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
        <div className="wp-citation-snippet">
            <pre className="wp-block-code">
                <code>{props.code}</code>
            </pre>
            <button
                className={classnames("citation-copy-button", {
                    "citation-copy-button--has-copied": hasCopied,
                })}
                onClick={copy}
                aria-label="Copy to clipboard"
            >
                <FontAwesomeIcon icon={faCopy} />
            </button>
        </div>
    )
}

export const hydrateCitationSnippets = () => {
    const citationSnippets = document.querySelectorAll(
        "div.wp-citation-snippet"
    )

    citationSnippets.forEach((snippet) => {
        const code =
            snippet.querySelector(".wp-block-code code")?.textContent || ""
        ReactDOM.hydrate(<CitationSnippet code={code} />, snippet.parentElement)
    })
}

export const renderCitationSnippets = ($: CheerioStatic) => {
    const citationSnippets = $("div.wp-citation-snippet")
    citationSnippets.each((_, snippet) => {
        const $el = $(snippet)
        const $dry = $(
            ReactDOMServer.renderToStaticMarkup(
                <div>
                    <CitationSnippet code={$el.text().trim()} />
                </div>
            )
        )
        $el.after($dry)
        $el.remove()
    })
}
