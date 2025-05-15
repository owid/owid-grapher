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
        .with(FilterType.QUERY, () => (
            <span className="search-autocomplete-item-contents__type-query">
                <FontAwesomeIcon icon={faSearch} />
                {name}
            </span>
        ))
        .with(FilterType.COUNTRY, () => {
            return (
                <>
                    {baseQuery && (
                        <span className="search-autocomplete-item-contents__base-query">
                            {baseQuery}
                        </span>
                    )}
                    <SearchFilterPill
                        name={name}
                        icon={SearchCountryPillIcon(name)}
                    />
                </>
            )
        })
        .with(FilterType.TOPIC, () => (
            <>
                {baseQuery && (
                    <span className="search-autocomplete-item-contents__base-query">
                        {baseQuery}
                    </span>
                )}
                <SearchFilterPill name={name} icon={SearchTopicPillIcon} />
            </>
        ))
        .exhaustive()
}
