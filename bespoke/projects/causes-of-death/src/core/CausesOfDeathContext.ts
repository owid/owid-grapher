import { createContext, useContext } from "react"

export const CausesOfDeathChartContext = createContext<{ isMobile: boolean }>({
    isMobile: false,
})

export const useCausesOfDeathChartContext = () =>
    useContext(CausesOfDeathChartContext)
