import { useCallback, useEffect, useState } from "react"
import {
    GdocsContentSource,
    OwidArticleType,
    OwidArticleTypeJSON,
    SiteFooterContext,
} from "../clientUtils/owidTypes.js"
import { getArticleFromJSON } from "../clientUtils/Util.js"
import { useDebounceCallback, useInterval } from "../site/hooks.js"
import { runSiteFooterScripts } from "../site/runSiteFooterScripts.js"
import { Admin } from "./Admin.js"
import { checkHasChanges, checkLightningUpdate } from "./gdocsDeploy.js"
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
        setLightningUpdate(checkLightningUpdate(prevGdoc, nextGdoc, hasChanges))
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
) => {
    const [syncingError, setSyncingError] = useState(false)
    const initialLoad = !gdoc

    const updatePreviewContent = useCallback(async () => {
        try {
            const draftGdocJson = (await admin.requestJSON(
                `/api/gdocs/${id}?contentSource=${GdocsContentSource.Gdocs}`,
                {},
                "GET",
                { onFailure: "continue" }
            )) as OwidArticleTypeJSON

            const draftGdoc = getArticleFromJSON(draftGdocJson)

            setGdoc((currGdoc: OwidArticleType | undefined) =>
                currGdoc
                    ? { ...currGdoc, content: draftGdoc.content }
                    : draftGdoc
            )
            setSyncingError(false)
        } catch (e) {
            console.log(e)
            setSyncingError(true)
        }
    }, [admin, id, setGdoc])

    // Initial load behaviours
    useEffect(() => {
        if (initialLoad) {
            updatePreviewContent()
        } else {
            admin.loadingIndicatorSetting = "off"
        }
    }, [admin, updatePreviewContent, initialLoad])

    useEffect(() => {
        runSiteFooterScripts(SiteFooterContext.gdocsPreview)
    }, [gdoc])

    // Sync content every 5 seconds
    useInterval(updatePreviewContent, 5000)

    return syncingError
}
