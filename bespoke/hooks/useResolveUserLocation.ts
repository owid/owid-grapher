import { useEffect, useRef, useState } from "react"
import { useUserCountryInformation } from "./useUserCountryInformation.js"
import { useEmbedConfig } from "./useEmbedConfig.js"

const USER_LOCATION_CONFIG_OPTION = "userLocation"

export function isUserLocationCountry(
    configCountry: string | undefined
): boolean {
    return configCountry === USER_LOCATION_CONFIG_OPTION
}

export function useResolveUserLocation({
    configCountry,
    availableCountryNames,
    urlStateKey,
    setCountry,
}: {
    configCountry: string | undefined
    availableCountryNames: Set<string> | undefined
    urlStateKey: string
    setCountry: (name: string) => void
}): { isResolved: boolean } {
    const { urlSync } = useEmbedConfig()
    const isUserLocation = isUserLocationCountry(configCountry)

    const [isResolved, setIsResolved] = useState(!isUserLocation)
    const resolved = useRef(!isUserLocation)

    const { data: userCountryInfo } = useUserCountryInformation({
        enabled: isUserLocation,
    })

    // Resolves once, when the URL or the async location lookup settles it
    /* oxlint-disable react/set-state-in-effect */
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
    /* oxlint-enable react/set-state-in-effect */

    return { isResolved }
}
