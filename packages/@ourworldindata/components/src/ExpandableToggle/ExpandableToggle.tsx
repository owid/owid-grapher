import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import type { ReactNode } from "react"
import cx from "classnames"

export const ExpandableToggle = ({
    label,
    content,
    alwaysVisibleDescription,
    isExpandedDefault = false,
    isStacked = false,
    hasTeaser = false,
}: {
    label: string
    content?: ReactNode
    alwaysVisibleDescription?: ReactNode
    isExpandedDefault?: boolean
    isStacked?: boolean
    hasTeaser?: boolean
}) => {
    const contentElem = (
        <div className="ExpandableToggle__content">{content}</div>
    )

    return (
        <details
            className={cx("ExpandableToggle", {
                "ExpandableToggle--stacked": isStacked,
                "ExpandableToggle--teaser": hasTeaser,
            })}
            open={isExpandedDefault}
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
                    <FontAwesomeIcon
                        className="ExpandableToggle__icon ExpandableToggle__icon--expand"
                        icon={faPlus}
                    />
                    <FontAwesomeIcon
                        className="ExpandableToggle__icon ExpandableToggle__icon--collapse"
                        icon={faMinus}
                    />
                </div>

                {/* If there is a teaser, we need to place the content element inside the summary so we can show it even when the details element is closed */}
                {hasTeaser && contentElem}
            </summary>
            {!hasTeaser && contentElem}
        </details>
    )
}
