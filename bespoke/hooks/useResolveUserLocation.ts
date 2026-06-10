import { useEffect, useRef, useState } from "react"
import { useUserCountryInformation } from "./useUserCountryInformation.js"

const USER_LOCATION_CONFIG_OPTION = "userLocation"

export function isUserLocationCountry(
    configCountry: string | undefined
): boolean {
    return configCountry === USER_LOCATION_CONFIG_OPTION
}

export function useResolveUserLocation({
    configCountry,
    availableCountryNames,
    urlSync,
    urlStateKey,
    setCountry,
}: {
    configCountry: string | undefined
    availableCountryNames: Set<string> | undefined
    urlSync: boolean
    urlStateKey: string
    setCountry: (name: string) => void
}): { isResolved: boolean } {
    const isUserLocation = isUserLocationCountry(configCountry)

    const [isResolved, setIsResolved] = useState(!isUserLocation)
    const resolved = useRef(!isUserLocation)

    const { data: userCountryInfo } = useUserCountryInformation({
        enabled: isUserLocation,
    })

    useEffect(() => {
        if (resolved.current) return

        // An explicit country in the URL (e.g. a shared link) wins over
        // detection, so resolve immediately without waiting for geolocation
        if (
            urlSync &&
            new URLSearchParams(window.location.search).has(urlStateKey)
        ) {
            resolved.current = true
            setIsResolved(true)
            return
        }

        if (!userCountryInfo || !availableCountryNames) return

        resolved.current = true
        setIsResolved(true)

        if (availableCountryNames.has(userCountryInfo.name))
            setCountry(userCountryInfo.name)
    }, [
        userCountryInfo,
        availableCountryNames,
        urlSync,
        urlStateKey,
        setCountry,
    ])

    return { isResolved }
}
