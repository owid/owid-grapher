import { useEffect, useState } from "react"
import { OwidDocumentInterface } from "@ourworldindata/utils"
import { useDebounceCallback } from "../site/hooks.js"
import { checkHasChanges, checkIsLightningUpdate } from "./gdocsDeploy.js"
import { useGdocsStore } from "./GdocsStore.js"

export const useGdocsChanged = (
    prevGdoc: OwidDocumentInterface | undefined,
    nextGdoc: OwidDocumentInterface | undefined
) => {
    const [hasChanges, setHasChanges] = useState(false)

    useEffect(() => {
        if (!prevGdoc || !nextGdoc) return
        setHasChanges(checkHasChanges(prevGdoc, nextGdoc))
    }, [prevGdoc, nextGdoc])

    return hasChanges
}

export const useLightningUpdate = (
    prevGdoc: OwidDocumentInterface | undefined,
    nextGdoc: OwidDocumentInterface | undefined,
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
    currentGdoc: OwidDocumentInterface | undefined,
    hasChanges: boolean
) => {
    const store = useGdocsStore()

    const saveDraft = useDebounceCallback(
        (currentGdoc: OwidDocumentInterface) => {
            store.update(currentGdoc)
        },
        2000
    )

    useEffect(() => {
        if (!currentGdoc || !hasChanges || currentGdoc.published) return
        saveDraft(currentGdoc)
    }, [saveDraft, currentGdoc, hasChanges])
}
