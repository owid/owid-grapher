import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import type { ReactNode } from "react"
import cx from "clsx"

export const ExpandableToggle = ({
    label,
    content,
    alwaysVisibleDescription,
    isExpandedDefault = false,
    isStacked = false,
    hasTeaser = false,
    contentId,
    onToggle,
}: {
    label: string
    content?: ReactNode
    alwaysVisibleDescription?: ReactNode
    isExpandedDefault?: boolean
    isStacked?: boolean
    hasTeaser?: boolean
    contentId?: string
    /** Called with the new open state whenever the toggle expands or collapses. */
    onToggle?: (isOpen: boolean) => void
}) => (
    <details
        className={cx("ExpandableToggle", {
            "ExpandableToggle--stacked": isStacked,
            "ExpandableToggle--teaser": hasTeaser,
        })}
        open={isExpandedDefault}
        // React 19 simulates bubbling for `toggle`, so a nested <details>
        // inside the content would otherwise fire this handler too. Guard to
        // only react to this element's own toggle.
        onToggle={(e) => {
            if (e.target === e.currentTarget) onToggle?.(e.currentTarget.open)
        }}
    >
        <summary className="ExpandableToggle__container">
            <div className="ExpandableToggle__button">
                <div>
                    <h4 className="ExpandableToggle__title">{label}</h4>
                    {alwaysVisibleDescription && (
                        <div className="ExpandableToggle__description">
                            {alwaysVisibleDescription}
                        </div>
                    )}
                </div>

                {/* We show both the opened and closed icons, and use CSS to hide/show them based on the state */}
                <FontAwesomeIcon
                    className="ExpandableToggle__icon ExpandableToggle__icon--expand"
                    icon={faPlus}
                />
                <FontAwesomeIcon
                    className="ExpandableToggle__icon ExpandableToggle__icon--collapse"
                    icon={faMinus}
                />
            </div>

            {/* If there is a teaser, we need to place the content element inside the summary so it is visible even when the details element is closed.
            Also, make it inert so it isn't included in the browser Cmd-F search - instead, the browser will auto-expand it when searching for content that's currently collapsed */}
            {hasTeaser && (
                <div className="ExpandableToggle__teaser" inert>
                    {content}
                </div>
            )}
        </summary>
        <div className="ExpandableToggle__content" id={contentId}>
            {content}
        </div>
    </details>
)
