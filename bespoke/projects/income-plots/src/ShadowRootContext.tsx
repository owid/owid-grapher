import { createContext, useContext } from "react"

export const ShadowRootContext = createContext<HTMLElement | null>(null)

export const useShadowRoot = () => useContext(ShadowRootContext)
