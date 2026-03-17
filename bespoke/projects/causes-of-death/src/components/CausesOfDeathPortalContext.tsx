import { createContext, useContext } from "react"

/**
 * Holds a reference to the Shadow DOM container element.
 *
 * Components that portal UI (dropdowns, tooltips, modals) need to render
 * inside the Shadow DOM — otherwise their content lands in document.body
 * where the component's scoped styles aren't available.
 */
export const CausesOfDeathPortalContext = createContext<
    HTMLElement | undefined
>(undefined)

export const usePortalContainer = () => useContext(CausesOfDeathPortalContext)
