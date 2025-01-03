import { useEffect, useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faCopy } from "@fortawesome/free-solid-svg-icons"
import { canWriteToClipboard } from "@ourworldindata/utils"
import cx from "classnames"
import { SimpleMarkdownText } from "../SimpleMarkdownText"

export const CodeSnippet = ({
    className,
    code,
    theme = "dark",
    isTruncated = false,
    useMarkdown = false,
}: {
    className?: string
    code: string
    theme?: "dark" | "light"
    isTruncated?: boolean
    useMarkdown?: boolean
}) => {
    const [canCopy, setCanCopy] = useState(false)
    const [hasCopied, setHasCopied] = useState(false)

    useEffect(() => {
        void canWriteToClipboard().then(setCanCopy)
    }, [])

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code)
            setHasCopied(true)
            // reset CSS animation
            setTimeout(() => setHasCopied(false), 2000)
        } catch (err) {
            console.error(
                "Couldn't copy to clipboard using navigator.clipboard",
                err
            )
        }
    }

    return (
        <div
            className={cx(
                `wp-code-snippet wp-code-snippet--${theme}`,
                className
            )}
        >
            <pre className="wp-block-code">
                <code
                    className={cx("wp-code-snippet__code", {
                        "wp-code-snippet__code--is-truncated": isTruncated,
                    })}
                >
                    {useMarkdown ? (
                        <SimpleMarkdownText text={code} useParagraphs={false} />
                    ) : (
                        code
                    )}
                </code>
            </pre>
            {canCopy && (
                <button
                    className={cx("code-copy-button", {
                        "code-copy-button--has-copied": hasCopied,
                    })}
                    onClick={copy}
                    aria-label="Copy to clipboard"
                >
                    {hasCopied ? "Copied!" : <FontAwesomeIcon icon={faCopy} />}
                </button>
            )}
        </div>
    )
}
