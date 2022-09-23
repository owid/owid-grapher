import { useCallback, useEffect, useState } from "react"
import {
    GdocsContentSource,
    OwidArticleType,
} from "../clientUtils/owidTypes.js"
import { isEqual } from "../clientUtils/Util.js"
import { useInterval } from "../site/hooks.js"
import { Admin } from "./Admin.js"

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

export const useUpdatePreviewContent = (
    id: string,
    initialLoad: boolean,
    setGdoc: React.Dispatch<React.SetStateAction<OwidArticleType | undefined>>,
    admin: Admin
) => {
    const [syncingError, setSyncingError] = useState(false)

    const updatePreviewContent = useCallback(async () => {
        try {
            const draftGdoc = (await admin.requestJSON(
                `/api/gdocs/${id}?contentSource=${GdocsContentSource.Gdocs}`,
                {},
                "GET",
                { onFailure: "continue" }
            )) as OwidArticleType
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
