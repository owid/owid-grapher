import { InlineEntitySelector } from "./InlineEntitySelector.js"
import { formatEntityNameForSentence } from "../../../../helpers/entityNames.js"
import type { DemographyMetadata } from "../helpers/types.js"

export function EntityNameOrSelector({
    hideEntitySelector,
    entityName,
    countryName,
    metadata,
    onChange,
}: {
    hideEntitySelector?: boolean
    entityName: string
    countryName: string
    metadata: DemographyMetadata
    onChange: (name: string) => void
}): React.ReactElement {
    if (hideEntitySelector)
        return <>{formatEntityNameForSentence(countryName, ["UN"])}</>

    return (
        <InlineEntitySelector
            metadata={metadata}
            entityName={entityName}
            onChange={onChange}
        />
    )
}
