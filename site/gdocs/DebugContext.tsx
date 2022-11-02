import React, { createContext, useState } from "react"

interface DebugContextType {
    isPreviewing: boolean
}

const DebugContext = createContext<DebugContextType | undefined>(undefined)

export const DebugProvider = ({
    isPreviewing = false,
    children,
}: {
    isPreviewing: boolean
    children: React.ReactNode
}) => {
    const [debug] = useState({ isPreviewing })

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
