import { useState } from "react"
import cx from "clsx"
import { faCheck, faChain } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { copyToClipboard } from "@ourworldindata/utils"
import { BAKED_BASE_URL } from "../../../settings/clientSettings.mjs"

/** Copies a page's canonical URL to the clipboard. `path` is site-relative
 * (e.g. "/data-insights/some-slug"); the baked base URL is prepended so the
 * reader gets a shareable absolute link. */
export default function CopyLinkButton({
    path,
    trackNote,
    className,
}: {
    path: string
    trackNote: string
    className?: string
}) {
    const [hasCopied, setHasCopied] = useState(false)
    return (
        <>
            <button
                aria-label="Copy link to clipboard"
                data-track-note={trackNote}
                id="copy-link-button"
                className={cx("copy-link-button body-3-medium", className)}
                onClick={async () => {
                    if (!(await copyToClipboard(`${BAKED_BASE_URL}${path}`)))
                        return
                    setHasCopied(true)
                    setTimeout(() => {
                        setHasCopied(false)
                    }, 1000)
                }}
            >
                {hasCopied ? (
                    <>
                        <FontAwesomeIcon icon={faCheck} /> Copied!
                    </>
                ) : (
                    <>
                        <FontAwesomeIcon icon={faChain} /> Copy link
                    </>
                )}
            </button>
            <span role="status" className="sr-only">
                {hasCopied ? "Link copied to clipboard" : ""}
            </span>
        </>
    )
}
