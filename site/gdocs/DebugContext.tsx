import { createContext } from "react"
import * as React from "react"

const DebugContext = createContext<boolean | undefined>(undefined)

export const DebugProvider = ({
    children,
    debug = false,
}: {
    children: React.ReactNode
    debug?: boolean
}) => {
    return (
        <DebugContext.Provider value={debug}>{children}</DebugContext.Provider>
    )
}

export const useDebug = () => {
    const context = React.useContext(DebugContext)

    if (context === undefined) {
        throw new Error("useDebug must be used within a DebugProvider")
    }
    return context
}
