import { createContext, useContext } from "react"

import type { EmbedOptions } from "../shared/bespokeComponentTypes.js"

const EmbedOptionsContext = createContext<EmbedOptions>({})

export function EmbedOptionsProvider({
    options = {},
    children,
}: {
    options: EmbedOptions | undefined
    children: React.ReactNode
}): React.ReactElement {
    return (
        <EmbedOptionsContext.Provider value={options}>
            {children}
        </EmbedOptionsContext.Provider>
    )
}

export function useEmbedOptions(): EmbedOptions {
    return useContext(EmbedOptionsContext)
}
