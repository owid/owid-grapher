import { createContext, useContext } from "react"

export const ConflictDeathsChartContext = createContext<{ isMobile: boolean }>({
    isMobile: false,
})

export const useConflictDeathsChartContext = () =>
    useContext(ConflictDeathsChartContext)
