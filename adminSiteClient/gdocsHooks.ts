import { useEffect, useState } from "react"
import { OwidGdoc, checkIsGdocPost } from "@ourworldindata/utils"
import { checkHasChanges, checkIsLightningUpdate } from "./gdocsDeploy.js"

export const useGdocsChanged = (
    prevGdoc: OwidGdoc | undefined,
    nextGdoc: OwidGdoc | undefined
) => {
    const [hasChanges, setHasChanges] = useState(false)

    useEffect(() => {
        if (!prevGdoc || !nextGdoc) return
        setHasChanges(checkHasChanges(prevGdoc, nextGdoc))
    }, [prevGdoc, nextGdoc])

    return hasChanges
}

export const useLightningUpdate = (
    prevGdoc: OwidGdoc | undefined,
    nextGdoc: OwidGdoc | undefined,
    hasChanges: boolean
) => {
    const [isLightningDeploy, setLightningUpdate] = useState(false)

    useEffect(() => {
        if (!checkIsGdocPost(prevGdoc) || !checkIsGdocPost(nextGdoc)) return
        setLightningUpdate(
            checkIsLightningUpdate(prevGdoc, nextGdoc, hasChanges)
        )
    }, [prevGdoc, nextGdoc, hasChanges])

    return isLightningDeploy
}
