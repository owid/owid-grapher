import { faSearch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { countriesByName } from "@ourworldindata/utils"

export function AutocompleteItemContents({
    type,
    name,
}: {
    type: string
    name: string
}) {
    if (type === "country") {
        return (
            <span className="country">
                <img
                    className="flag"
                    aria-hidden={true}
                    height={12}
                    width={16}
                    src={`/images/flags/${countriesByName()[name].code}.svg`}
                />
                {name}
            </span>
        )
    }
    if (type === "topic") {
        return <span className="topic">{name}</span>
    }
    if (type === "query") {
        return (
            <span>
                <FontAwesomeIcon icon={faSearch} />
                {name}
            </span>
        )
    }
    return null
}
