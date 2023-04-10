import { useEffect, useState } from "react"
import { OwidDocument } from "@ourworldindata/utils"
import { useDebounceCallback } from "../site/hooks.js"
import { checkHasChanges, checkIsLightningUpdate } from "./gdocsDeploy.js"
import { useGdocsStore } from "./GdocsStore.js"

export const useGdocsChanged = (
    prevGdoc: OwidDocument | undefined,
    nextGdoc: OwidDocument | undefined
) => {
    const [hasChanges, setHasChanges] = useState(false)

    useEffect(() => {
        if (!prevGdoc || !nextGdoc) return
        setHasChanges(checkHasChanges(prevGdoc, nextGdoc))
    }, [prevGdoc, nextGdoc])

    return hasChanges
}

export const useLightningUpdate = (
    prevGdoc: OwidDocument | undefined,
    nextGdoc: OwidDocument | undefined,
    hasChanges: boolean
) => {
    const [isLightningDeploy, setLightningUpdate] = useState(false)

    useEffect(() => {
        if (!prevGdoc || !nextGdoc) return
        setLightningUpdate(
            checkIsLightningUpdate(prevGdoc, nextGdoc, hasChanges)
        )
    }, [prevGdoc, nextGdoc, hasChanges])

    return isLightningDeploy
}

export const useAutoSaveDraft = (
    currentGdoc: OwidDocument | undefined,
    hasChanges: boolean
) => {
    const store = useGdocsStore()

    const saveDraft = useDebounceCallback((currentGdoc: OwidDocument) => {
        store.update(currentGdoc)
    }, 2000)

    useEffect(() => {
        if (!currentGdoc || !hasChanges || currentGdoc.published) return
        saveDraft(currentGdoc)
    }, [saveDraft, currentGdoc, hasChanges])
}
