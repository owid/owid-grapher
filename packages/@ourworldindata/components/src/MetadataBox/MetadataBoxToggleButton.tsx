import { faCaretDown, faCaretUp } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

interface MetadataBoxToggleButtonProps {
    detailsRef: React.RefObject<HTMLDetailsElement | null>
    /** The id of the <details> it opens and closes */
    detailsId?: string
}

/**
 * Opens and closes a MetadataBoxExpander from the top of the box.
 *
 * The label follows the <details> state through CSS rather than React state,
 * so it needs no syncing and matches the server render. Without JavaScript
 * the button can't do anything, so it's hidden and the expander's own
 * <summary> remains.
 */
export function MetadataBoxToggleButton({
    detailsRef,
    detailsId,
}: MetadataBoxToggleButtonProps): React.ReactElement {
    return (
        <button
            type="button"
            className="metadata-box-toggle-button js--hide-if-js-disabled"
            data-track-note="metadata_box_top_toggle"
            aria-controls={detailsId}
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
