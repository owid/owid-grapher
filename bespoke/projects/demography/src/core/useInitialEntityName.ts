import { useState } from "react"
import { isUserLocationCountry } from "../../../../hooks/useResolveUserLocation.js"
import { useUserCountryInformation } from "../../../../hooks/useUserCountryInformation.js"
import { DEFAULT_ENTITY_NAME } from "./constants.js"
import { useDemographyMetadata } from "./fetch.js"

export function useInitialEntityName(
    configRegion: string,
    metadataUrl: string
): [string, (name: string) => void, boolean] {
    const isUserLocation = isUserLocationCountry(configRegion)
    const initialName = isUserLocation ? DEFAULT_ENTITY_NAME : configRegion

    const [entityName, setEntityName] = useState(initialName)
    const [isResolved, setIsResolved] = useState(!isUserLocation)

    const { data: userCountryInfo } = useUserCountryInformation()
    const { data: metadata } = useDemographyMetadata(metadataUrl)

    // Resolve once, as soon as the user's location and the metadata are known
    if (!isResolved && isUserLocation && userCountryInfo && metadata) {
        setIsResolved(true)

        const availableSet = new Set(metadata.countries)
        if (availableSet.has(userCountryInfo.name)) {
            setEntityName(userCountryInfo.name)
        }
    }

    return [entityName, setEntityName, isResolved]
}
