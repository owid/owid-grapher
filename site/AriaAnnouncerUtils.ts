import * as R from "remeda"
import { createContext, useContext } from "react"

interface AriaAnnouncerContextType {
    announce: (message: string) => void
    announcement: string
}

export const AriaAnnouncerContext =
    createContext<AriaAnnouncerContextType | null>(null)

export const useAriaAnnouncer = () => {
    const context = useContext(AriaAnnouncerContext)
    if (!context) {
        // Fallback for cases where the component is used outside of AriaAnnouncerProvider
        return {
            announce: R.identity,
            announcement: "",
        }
    }
    return context
}
