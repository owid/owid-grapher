import { createContext, useContext } from "react"
import { GdocsStore } from "./GdocsStore.js"

export const GdocsStoreContext = createContext<GdocsStore | undefined>(
    undefined
)

export const useGdocsStore = () => {
    const context = useContext(GdocsStoreContext)
    if (context === undefined) {
        throw new Error(
            "useGdocsStore must be used within a GdocsStoreProvider"
        )
    }
    return context
}
