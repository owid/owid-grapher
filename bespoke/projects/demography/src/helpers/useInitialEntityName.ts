import { useState, useEffect, useRef } from "react"
import { DEFAULT_ENTITY_NAME } from "./constants.js"
import { useDemographyMetadata, useUserCountryInformation } from "./fetch.js"

const USER_LOCATION = "userLocation"

/**
 * Resolve the initial entity name from config.
 *
 * - If `configRegion` is a specific name, use it directly.
 * - If `configRegion` is "userLocation", detect the user's country
 *   and use it if available in the metadata. Falls back to the default.
 * - If `configRegion` is undefined, use the default.
 */
export function useInitialEntityName(
    configRegion: string | undefined
): [string, (name: string) => void] {
    const isUserLocation = configRegion === USER_LOCATION
    const initialName =
        configRegion && !isUserLocation ? configRegion : DEFAULT_ENTITY_NAME

    const [entityName, setEntityName] = useState(initialName)
    const resolved = useRef(!isUserLocation)

    const { data: userCountryInfo } = useUserCountryInformation()
    const { data: metadata } = useDemographyMetadata()

    useEffect(() => {
        if (resolved.current || !isUserLocation) return
        if (!userCountryInfo || !metadata) return

        resolved.current = true
        const availableSet = new Set(metadata.countries)
        if (availableSet.has(userCountryInfo.name)) {
            setEntityName(userCountryInfo.name)
        }
    }, [isUserLocation, userCountryInfo, metadata])

    return [entityName, setEntityName]
}
