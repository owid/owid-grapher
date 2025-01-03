import { createContext, useContext } from "react"

export const DebugContext = createContext<boolean | undefined>(undefined)

export const useDebug = () => {
    const context = useContext(DebugContext)

    if (context === undefined) {
        throw new Error("useDebug must be used within a DebugProvider")
    }
    return context
}
