import { faCaretDown, faCaretUp } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useEffect, useState } from "react"

interface MetadataBoxToggleButtonProps {
    detailsRef: React.RefObject<HTMLDetailsElement | null>
    detailsId?: string
}

/**
 * Toggles a MetadataBoxExpander from the top of the box. The label follows the
 * <details> through CSS, so it matches the server render; hidden without JS.
 */
export function MetadataBoxToggleButton({
    detailsRef,
    detailsId,
}: MetadataBoxToggleButtonProps): React.ReactElement {
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        const details = detailsRef.current
        if (!details) return
        const onToggle = (): void => setIsOpen(details.open)
        onToggle()
        details.addEventListener("toggle", onToggle)
        return () => details.removeEventListener("toggle", onToggle)
    }, [detailsRef])

    return (
        <button
            type="button"
            className="metadata-box-toggle-button js--hide-if-js-disabled"
            data-track-note="metadata_box_top_toggle"
            aria-controls={detailsId}
            aria-expanded={isOpen}
            onClick={() => {
                const details = detailsRef.current
                if (details) details.open = !details.open
            }}
        >
            <span className="metadata-box-toggle-button__show-more">
                Show more
                <FontAwesomeIcon
                    icon={faCaretDown}
                    className="metadata-box-toggle-button__caret"
                />
            </span>
            <span className="metadata-box-toggle-button__show-less">
                Show less
                <FontAwesomeIcon
                    icon={faCaretUp}
                    className="metadata-box-toggle-button__caret"
                />
            </span>
        </button>
    )
}
