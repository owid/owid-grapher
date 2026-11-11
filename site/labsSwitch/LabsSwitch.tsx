import { type SyntheticEvent } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRight, faFlask } from "@fortawesome/free-solid-svg-icons"

// Labs is a staff-only copy of the site with experimental features switched
// on, reachable over Tailscale only (`labs` branch, see infra/labs/ in
// owid/ops). This button takes staff from a page to the same page on Labs;
// the Labs bar there takes them back.
const LABS_URL = "http://labs.owid.io"

function labsUrlForCurrentPage(): string {
    const { pathname, search, hash } = window.location
    return `${LABS_URL}${pathname}${search}${hash}`
}

export function LabsSwitch() {
    // Charts keep their state in the URL, so take the address when it's used
    const pointAtCurrentPage = (
        event: SyntheticEvent<HTMLAnchorElement>
    ): void => {
        event.currentTarget.href = labsUrlForCurrentPage()
    }

    return (
        <a
            className="labs-switch"
            href={LABS_URL}
            onPointerDown={pointAtCurrentPage}
            onFocus={pointAtCurrentPage}
            aria-label="Open this page in Labs"
            title="Labs needs Tailscale"
        >
            <span className="labs-switch__tile" aria-hidden="true">
                <FontAwesomeIcon icon={faFlask} />
            </span>
            <span className="labs-switch__label">
                Open this page in Labs
                <FontAwesomeIcon icon={faArrowRight} />
            </span>
        </a>
    )
}
