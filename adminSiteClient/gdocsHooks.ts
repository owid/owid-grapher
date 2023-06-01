import { useEffect, useState } from "react"
import { OwidGdocInterface } from "@ourworldindata/utils"
import { checkHasChanges, checkIsLightningUpdate } from "./gdocsDeploy.js"

export const useGdocsChanged = (
    prevGdoc: OwidGdocInterface | undefined,
    nextGdoc: OwidGdocInterface | undefined
) => {
    const [hasChanges, setHasChanges] = useState(false)

    useEffect(() => {
        if (!prevGdoc || !nextGdoc) return
        setHasChanges(checkHasChanges(prevGdoc, nextGdoc))
    }, [prevGdoc, nextGdoc])

    return hasChanges
}

export const useLightningUpdate = (
    prevGdoc: OwidGdocInterface | undefined,
    nextGdoc: OwidGdocInterface | undefined,
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
