import { faSearch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { match } from "ts-pattern"
import { FilterType } from "./searchTypes"
import {
    SearchCountryPillIcon,
    SearchFilterPill,
    SearchTopicPillIcon,
} from "./SearchFilterPill.js"

export function SearchAutocompleteItemContents({
    type,
    name,
    baseQuery,
}: {
    type: FilterType
    name: string
    baseQuery?: string
}) {
    return match(type)
        .with(FilterType.COUNTRY, () => {
            return (
                <>
                    {baseQuery && <span> {baseQuery}</span>}
                    <SearchFilterPill
                        name={name}
                        icon={SearchCountryPillIcon(name)}
                    />
                </>
            )
        })
        .with(FilterType.TOPIC, () => (
            <>
                {baseQuery && <span> {baseQuery}</span>}
                <SearchFilterPill name={name} icon={SearchTopicPillIcon} />
            </>
        ))
        .with(FilterType.QUERY, () => (
            <span>
                <FontAwesomeIcon icon={faSearch} />
                {name}
            </span>
        ))
        .exhaustive()
}
