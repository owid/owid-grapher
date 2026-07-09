import { createContext, useContext } from "react"

export const WhereAreThePoorChartContext = createContext<{
    isMobile: boolean
}>({
    isMobile: false,
})

export const useWhereAreThePoorChartContext = () =>
    useContext(WhereAreThePoorChartContext)
