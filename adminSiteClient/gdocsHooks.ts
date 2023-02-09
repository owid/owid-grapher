import { useCallback, useEffect, useState } from "react"
import {
    GdocsContentSource,
    OwidArticleType,
    OwidArticleTypeJSON,
    getArticleFromJSON,
    checkIsPlainObjectWithGuard,
} from "@ourworldindata/utils"
import { useDebounceCallback, useInterval } from "../site/hooks.js"
import { Admin } from "./Admin.js"
import { checkHasChanges, checkIsLightningUpdate } from "./gdocsDeploy.js"
import { useGdocsStore } from "./GdocsStore.js"

export const useGdocsChanged = (
    prevGdoc: OwidArticleType | undefined,
    nextGdoc: OwidArticleType | undefined
) => {
    const [hasChanges, setHasChanges] = useState(false)

    useEffect(() => {
        if (!prevGdoc || !nextGdoc) return
        setHasChanges(checkHasChanges(prevGdoc, nextGdoc))
    }, [prevGdoc, nextGdoc])

    return hasChanges
}

export const useLightningUpdate = (
    prevGdoc: OwidArticleType | undefined,
    nextGdoc: OwidArticleType | undefined,
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
    gdoc: OwidArticleType | undefined,
    setOriginalGdoc: (gdoc: OwidArticleType) => void,
    hasChanges: boolean
) => {
    const store = useGdocsStore()

    const saveDraft = useDebounceCallback((gdoc: OwidArticleType) => {
        store.update(gdoc)
        setOriginalGdoc(gdoc)
    }, 2000)

    useEffect(() => {
        if (!gdoc || !hasChanges || gdoc.published) return
        saveDraft(gdoc)
    }, [saveDraft, gdoc, hasChanges])
}
