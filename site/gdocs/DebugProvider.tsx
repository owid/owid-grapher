import { DebugContext } from "./DebugContext.js"

export function DebugProvider({
    children,
    debug = false,
}: {
    children: React.ReactNode
    debug?: boolean
}) {
    return (
        <DebugContext.Provider value={debug}>{children}</DebugContext.Provider>
    )
}
