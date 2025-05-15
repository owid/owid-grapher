import { faClose, faTag } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { countriesByName } from "@ourworldindata/utils"
import { ReactNode } from "react"

export function SearchFilterPill({
    name,
    hasCloseIcon = false,
    icon,
}: {
    name: string
    hasCloseIcon?: boolean
    icon: ReactNode
}) {
    return (
        <span className="search-filter-pill">
            {icon}
            {name}
            {hasCloseIcon && (
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
