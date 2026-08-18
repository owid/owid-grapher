import { useState, useEffect, useRef } from "react"
import { useUserCountryInformation } from "../../../../hooks/useUserCountryInformation.js"
import { DEFAULT_ENTITY_NAME } from "./constants.js"
import { useDemographyMetadata } from "./fetch.js"

const USER_LOCATION = "userLocation"

/**
 * Resolve the initial entity name from config.
 *
 * - If `configRegion` is a specific name, use it directly.
 * - If `configRegion` is "userLocation" or undefined, detect the user's country
 *   and use it if available in the metadata. Falls back to the default.
 */
export function useInitialEntityName(
    configRegion: string | undefined
): [string, (name: string) => void, boolean] {
    const isUserLocation = !configRegion || configRegion === USER_LOCATION
    const initialName =
        configRegion && !isUserLocation ? configRegion : DEFAULT_ENTITY_NAME

    const [entityName, setEntityName] = useState(initialName)
    const [isResolved, setIsResolved] = useState(!isUserLocation)
    const resolved = useRef(!isUserLocation)

    const { data: userCountryInfo } = useUserCountryInformation()
    const { data: metadata } = useDemographyMetadata()

    useEffect(() => {
        if (resolved.current || !isUserLocation) return
        if (!userCountryInfo || !metadata) return

        resolved.current = true
        setIsResolved(true)

        const availableSet = new Set(metadata.countries)
        if (availableSet.has(userCountryInfo.name)) {
            setEntityName(userCountryInfo.name)
        }
    }, [isUserLocation, userCountryInfo, metadata])

    return [entityName, setEntityName, isResolved]
}
