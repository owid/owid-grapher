import { useMemo } from "react"

import { DemographyMetadata } from "../helpers/types.js"
import { displayEntityName } from "../helpers/utils.js"

import { Frame } from "../../../../components/Frame/Frame.js"
import { EntityDropdown } from "../../../../components/EntityDropdown/EntityDropdown.js"

export function DemographyControls({
    metadata,
    entityName,
    setEntityName,
}: {
    metadata: DemographyMetadata
    entityName: string
    setEntityName: (entityName: string) => void
}): React.ReactElement {
    const entityOptions = useMemo(
        () =>
            metadata.countries.map((name) => ({
                value: name,
                label: displayEntityName(name),
            })),
        [metadata.countries]
    )

    return (
        <Frame className="demography-controls">
            <h3 className="demography-controls__title">
                Select a country or region
            </h3>
            <EntityDropdown
                className="demography-country-selector"
                label="Country/region"
                availableEntities={entityOptions}
                selectedEntityName={entityName}
                onChange={setEntityName}
                placeholder="Select a country or region..."
                aria-label="Select a country or region"
            />
        </Frame>
    )
}
