import { ReactNode } from "react"
import { faClose, faTag } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { countriesByName } from "@ourworldindata/utils"
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
            {name}
            {selected && (
                <span className="close">
                    <FontAwesomeIcon icon={faClose} />
                </span>
            )}
        </span>
    )
}

export const SearchTopicPillIcon = <FontAwesomeIcon icon={faTag} />
export const SearchCountryPillIcon = (name: string) => (
    <img
        className="flag"
        aria-hidden={true}
        height={12}
        width={16}
        src={`/images/flags/${countriesByName()[name].code}.svg`}
    />
)
