import { ReactNode } from "react"
import { faClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import cx from "classnames"

export function SearchFilterPill({
    name,
    selected = false,
    icon,
}: {
    name: string
    selected?: boolean
    icon: ReactNode
}) {
    return (
        <span
            className={cx("search-filter-pill", {
                "search-filter-pill--selected": selected,
            })}
        >
            {icon}
            <span className="name">{name}</span>
            {selected && (
                <span className="close">
                    <FontAwesomeIcon icon={faClose} />
                </span>
            )}
        </span>
    )
}
