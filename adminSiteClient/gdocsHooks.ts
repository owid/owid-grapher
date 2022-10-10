import { useCallback, useEffect, useState } from "react"
import {
    GdocsContentSource,
    OwidArticleContent,
    OwidArticleType,
    OwidArticleTypeJSON,
} from "../clientUtils/owidTypes.js"
import { getArticleFromJSON, isEqual } from "../clientUtils/Util.js"
import { useDebounceCallback, useInterval } from "../site/hooks.js"
import { Admin } from "./Admin.js"
import { useGdocsStore } from "./GdocsStore.js"

export const useGdocsChanged = (
    prevGdoc: OwidArticleType | undefined,
    nextGdoc: OwidArticleType | undefined
) => {
    const [hasChanges, setHasChanges] = useState(false)

    useEffect(() => {
        setHasChanges(!isEqual(prevGdoc, nextGdoc))
    }, [prevGdoc, nextGdoc])

    return hasChanges
}

export const useLightningDeploy = (
    prevGdoc: OwidArticleType | undefined,
    nextGdoc: OwidArticleType | undefined
) => {
    const [isLightningDeploy, setLightningDeploy] = useState(false)

    useEffect(() => {
        if (!prevGdoc || !nextGdoc) return

        const hasChanged = (prop: keyof OwidArticleType) => {
            return prevGdoc[prop] !== nextGdoc[prop]
        }

        const hasChangedDate = (
            prop: keyof Pick<OwidArticleType, "publishedAt">
        ) => {
            return prevGdoc[prop]?.getTime() !== nextGdoc[prop]?.getTime()
        }

        const hasChangedContent = (prop: keyof OwidArticleContent) => {
            return prevGdoc.content[prop] !== nextGdoc.content[prop]
        }

        // if any of the props that require a full deploy have changed, or the
        // article is a draft, then we can't do an instant deploy
        const requireFullDeploy =
            !prevGdoc.published ||
            hasChanged("slug") ||
            hasChangedDate("publishedAt") ||
            hasChangedContent("title") ||
            hasChangedContent("byline") ||
            hasChangedContent("excerpt")

        setLightningDeploy(!requireFullDeploy)
    }, [nextGdoc, prevGdoc])

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
    initialLoad: boolean,
    setGdoc: React.Dispatch<React.SetStateAction<OwidArticleType | undefined>>,
    admin: Admin
) => {
    const [syncingError, setSyncingError] = useState(false)

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

    // Sync content every 5 seconds
    useInterval(updatePreviewContent, 5000)

    return syncingError
}
