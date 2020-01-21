import * as React from "react"

import { RootStore } from "./Store"

export interface ExplorerViewContextType {
    store: RootStore
}

export const ExplorerViewContext: React.Context<ExplorerViewContextType> = React.createContext(
    {}
) as any
