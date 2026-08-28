import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import cx from "clsx"
import { useRef } from "react"

interface MetadataBoxExpanderProps {
    /** Rendered above the fold, outside the <details> */
    preview?: React.ReactNode
    children: React.ReactNode
    detailsRef?: React.RefObject<HTMLDetailsElement | null>
    onToggle?: (isOpen: boolean) => void
    className?: string
}

/**
 * An expander whose <summary> is the toggle in both directions, with the
 * viewport held in place on collapse.
 *
 * The scroll compensation is only correct while an ancestor sets
 * `overflow-anchor: none`.
 */
export function MetadataBoxExpander({
    preview,
    children,
    detailsRef,
    onToggle,
    className,
}: MetadataBoxExpanderProps): React.ReactElement {
    const fallbackDetailsRef = useRef<HTMLDetailsElement | null>(null)
    const resolvedDetailsRef = detailsRef ?? fallbackDetailsRef
    const summaryRef = useRef<HTMLElement>(null)

    const handleSummaryClick = (event: React.MouseEvent<HTMLElement>): void => {
        const details = resolvedDetailsRef.current
        const summary = summaryRef.current
        if (!details?.open || !summary) return // expanding — let the native toggle run
        event.preventDefault()
        const before = summary.getBoundingClientRect().top
        details.open = false
        const after = summary.getBoundingClientRect().top
        window.scrollBy(0, after - before)
    }

    return (
        <div className={cx("metadata-box-expander", className)}>
            {preview && (
                <div className="metadata-box-expander__preview metadata-box-expander__prose">
                    {preview}
                </div>
            )}
            <details
                className="metadata-box-expander__details"
                ref={resolvedDetailsRef}
                // React 19 simulates bubbling for `toggle`, so toggles from
                // nested <details> in the content would otherwise fire this
                // handler too. Guard to only react to this element's own toggle.
                onToggle={(e) => {
                    if (e.target !== e.currentTarget) return
                    onToggle?.(e.currentTarget.open)
                }}
            >
                <summary
                    className="metadata-box-expander__summary"
                    ref={summaryRef}
                    onClick={handleSummaryClick}
                >
                    <span className="metadata-box-expander__show-more">
                        Show more{" "}
                        <FontAwesomeIcon
                            className="metadata-box-expander__chevron"
                            icon={faChevronDown}
                        />
                    </span>
                    <span className="metadata-box-expander__show-less">
                        Show less{" "}
                        <FontAwesomeIcon
                            className="metadata-box-expander__chevron"
                            icon={faChevronUp}
                        />
                    </span>
                </summary>
                {children}
            </details>
        </div>
    )
}
