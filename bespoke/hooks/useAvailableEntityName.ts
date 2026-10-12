import { useEffect } from "react"

import { pickAvailableEntityName } from "../helpers/entityNames.js"

export function useAvailableEntityName(
    entityName: string,
    fallbacks: readonly string[],
    hasEntity: ((name: string) => boolean) | undefined
): string {
    const availableEntityName = hasEntity
        ? pickAvailableEntityName(entityName, fallbacks, hasEntity)
        : entityName

    useEffect(() => {
        if (availableEntityName !== entityName)
            console.warn(
                `"${entityName}" isn't in the data, showing "${availableEntityName}" instead`
            )
    }, [entityName, availableEntityName])

    return availableEntityName
}
