import { ReactNode } from "react"
import { faClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import cx from "classnames"

export function SearchFilterPill({
    name,
    selected = false,
    icon,
    className,
}: {
    name: string
    selected?: boolean
    icon: ReactNode
    className?: string
}) {
    const nameLabel = name.replaceAll(" and ", " & ")
    return (
        <span
            className={cx(
                "search-filter-pill",
                {
                    "search-filter-pill--selected": selected,
                },
                className
            )}
        >
            {icon}
            <span className="name">{nameLabel}</span>
            {selected && (
                <span className="close">
                    <FontAwesomeIcon icon={faClose} />
                </span>
            )}
        </span>
    )
}
