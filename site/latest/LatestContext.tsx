import { createContext, useContext } from "react"
import { SiteAnalytics } from "../SiteAnalytics.js"

interface LatestContextType {
    analytics: SiteAnalytics
}

export const LatestContext = createContext<LatestContextType | null>(null)

export const useLatestContext = () => {
    const context = useContext(LatestContext)
    if (!context) {
        throw new Error(
            "useLatestContext must be used within a LatestContext.Provider"
        )
    }
    return context
}
