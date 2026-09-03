import { createContext, useContext } from "react"

import type { EmbedConfig } from "../helpers/config.js"

/** Defaults to an in-article embed: no URL syncing unless the host asks for it */
const EmbedConfigContext = createContext<EmbedConfig>({ urlSync: false })

export function EmbedConfigProvider({
    config,
    children,
}: {
    config: EmbedConfig
    children: React.ReactNode
}): React.ReactElement {
    return (
        <EmbedConfigContext.Provider value={config}>
            {children}
        </EmbedConfigContext.Provider>
    )
}

export function useEmbedConfig(): EmbedConfig {
    return useContext(EmbedConfigContext)
}
