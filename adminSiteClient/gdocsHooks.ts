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
    setOriginalGdoc: React.Dispatch<
        React.SetStateAction<OwidArticleType | undefined>
    >,
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

export const useUpdatePreviewContent = (
    id: string,
    gdoc: OwidArticleType | undefined,
    setGdoc: React.Dispatch<React.SetStateAction<OwidArticleType | undefined>>,
    admin: Admin
): { hasSyncingError: boolean; criticalErrorMessage?: string } => {
    // When the server 500s, we don't want to continue polling it every 5 seconds
    const [criticalErrorMessage, setCriticalErrorMessage] = useState<
        undefined | string
    >()
    const [hasSyncingError, setHasSyncingError] = useState(false)
    const initialLoad = !gdoc

    const updatePreviewContent = useCallback(async () => {
        if (criticalErrorMessage) return
        try {
            // Because there's no ongoing connection between the server and client, a new document is being fetched every 5 seconds
            // Meaning we query Gdocs every 5 seconds for everything, which may become taxing at some point.
            // We should use the Page Visibility API to not query when the tab is inactive
            const draftGdocJson = (await admin.requestJSON(
                `/api/gdocs/${id}?contentSource=${GdocsContentSource.Gdocs}`,
                {},
                "GET",
                { onFailure: "continue" }
            )) as OwidArticleTypeJSON

            const draftGdoc = getArticleFromJSON(draftGdocJson)

            setGdoc((currGdoc: OwidArticleType | undefined) =>
                currGdoc
                    ? {
                          ...currGdoc,
                          content: draftGdoc.content,
                          revisionId: draftGdoc.revisionId,
                      }
                    : draftGdoc
            )
            setHasSyncingError(false)
        } catch (e) {
            if (checkIsPlainObjectWithGuard(e) && e.status === 500) {
                console.log("Critical error", e)
                setCriticalErrorMessage(e.message as string)
            } else {
                console.log("Syncing error", e)
                setHasSyncingError(true)
            }
        }
    }, [admin, id, setGdoc, criticalErrorMessage])

    // Initial load behaviours
    useEffect(() => {
        if (initialLoad) {
            updatePreviewContent()
        } else {
            admin.loadingIndicatorSetting = "off"
        }
    }, [admin, updatePreviewContent, initialLoad])

    // Sync content every 5 seconds
    useInterval(updatePreviewContent, 5000)

    return { hasSyncingError, criticalErrorMessage }
}
