import { useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faFlask, faLink, faXmark } from "@fortawesome/free-solid-svg-icons"
import { copyToClipboard } from "@ourworldindata/utils"

// Labs is a staff-only copy of the site, built from the `labs` branch: master
// plus every open PR labelled `labs`. This badge only exists on that branch.

const PUBLIC_BASE_URL = "https://ourworldindata.org"
const LABS_PRS_URL =
    "https://github.com/owid/owid-grapher/pulls?q=is%3Apr+is%3Aopen+label%3Alabs"

function publicUrlForCurrentPage(): string {
    const { pathname, search, hash } = window.location
    return `${PUBLIC_BASE_URL}${pathname}${search}${hash}`
}

export function LabsBadge() {
    const [isHidden, setIsHidden] = useState(false)
    const [isCopied, setIsCopied] = useState(false)

    const copyPublicLink = async (): Promise<void> => {
        const url = publicUrlForCurrentPage()
        if (await copyToClipboard(url)) {
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
        } else {
            window.prompt("Public link to this page", url)
        }
    }

    if (isHidden) return null

    return (
        <div className="labs-badge" role="status">
            <a
                className="labs-badge__title"
                href={LABS_PRS_URL}
                target="_blank"
                rel="noopener"
                title="What's on Labs"
            >
                <FontAwesomeIcon icon={faFlask} />
                You're on Labs
            </a>
            <button
                type="button"
                className="labs-badge__button"
                onClick={copyPublicLink}
            >
                <FontAwesomeIcon icon={faLink} />
                {isCopied ? "Copied" : "Copy public link"}
            </button>
            <button
                type="button"
                className="labs-badge__button labs-badge__button--icon"
                onClick={() => setIsHidden(true)}
                aria-label="Hide the Labs badge"
            >
                <FontAwesomeIcon icon={faXmark} />
            </button>
        </div>
    )
}
