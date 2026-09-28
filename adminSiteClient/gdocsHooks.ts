import { useMemo } from "react"
import {
    OwidGdoc,
    OwidGdocProfileInterface,
    checkIsGdocPost,
    getEntitiesForProfile,
} from "@ourworldindata/utils"
import { checkHasChanges, checkIsLightningUpdate } from "./gdocsDeploy.js"
import * as React from "react"

export const useGdocsChanged = (
    prevGdoc: OwidGdoc | undefined,
    nextGdoc: OwidGdoc | undefined
) => {
    return useMemo(
        () => !!prevGdoc && !!nextGdoc && checkHasChanges(prevGdoc, nextGdoc),
        [prevGdoc, nextGdoc]
    )
}

export const useLightningUpdate = (
    prevGdoc: OwidGdoc | undefined,
    nextGdoc: OwidGdoc | undefined,
    hasChanges: boolean
) => {
    return useMemo(
        () =>
            checkIsGdocPost(prevGdoc) &&
            checkIsGdocPost(nextGdoc) &&
            checkIsLightningUpdate(prevGdoc, nextGdoc, hasChanges),
        [prevGdoc, nextGdoc, hasChanges]
    )
}

/**
 * Hook to manage country profile selection in a Gdoc profile interface.
 * It provides a list of entities in scope and manages the selected entity state.
 *
 * @param gdoc - The Gdoc profile interface to extract entities from.
 * @returns An object containing the list of entities in scope, the selected entity, and a setter for the selected entity.
 */
export function useCountryProfileSelection(
    gdoc: OwidGdocProfileInterface | undefined
) {
    const entitiesInScope = React.useMemo(() => {
        if (!gdoc) return []
        const entitiesInScope = getEntitiesForProfile(
            gdoc.content.scope,
            gdoc.content.exclude
        )
        return entitiesInScope
            .filter((entity) => entity.code && entity.name)
            .map((entity) => ({
                value: entity.code,
                label: entity.name,
            }))
            .sort((a, b) => a.label.localeCompare(b.label))
    }, [gdoc])

    const [selectedEntity, setSelectedEntity] = React.useState<
        string | undefined
    >()

    // Default to the first entity once there are any
    if (selectedEntity === undefined && !!entitiesInScope.length) {
        setSelectedEntity(entitiesInScope[0].value)
    }

    return { entitiesInScope, selectedEntity, setSelectedEntity }
}
