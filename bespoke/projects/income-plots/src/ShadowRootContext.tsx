import { createContext, useContext } from "react"

export const ShadowRootContext = createContext<ShadowRoot | null>(null)

export const useShadowRoot = () => useContext(ShadowRootContext)
