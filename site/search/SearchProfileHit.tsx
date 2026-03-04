import { ProfileHit } from "@ourworldindata/types"
import { countriesByName } from "@ourworldindata/utils"
import { SearchTopicPageHit } from "./SearchTopicPageHit.js"

export function SearchProfileHit({
    className,
    hit,
    onClick,
}: {
    className?: string
    hit: ProfileHit
    onClick: VoidFunction
}) {
    const entityName = hit.availableEntities?.[0]
    const countryCode = entityName
        ? countriesByName()[entityName]?.code
        : undefined

    return (
        <SearchTopicPageHit
            className={className}
            hit={hit}
            flagCode={countryCode}
            onClick={onClick}
        />
    )
}
