import * as React from "react"

import { IndicatorStore } from "./IndicatorStore"

export interface ExplorerViewContextType {
    indicatorStore: IndicatorStore
}

export const ExplorerViewContext: React.Context<
    ExplorerViewContextType
> = React.createContext({}) as any
