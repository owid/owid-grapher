import { createContext, useContext } from "react"

// Context for mobile state
export const CausesOfDeathChartContext = createContext<{ isMobile: boolean }>({
    isMobile: false,
})

export const useCausesOfDeathChartContext = () =>
    useContext(CausesOfDeathChartContext)
