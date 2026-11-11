import * as React from "react"
import { createContext } from "react"

export interface VariableListLinkProps {
    /** The admin page's path, under /admin */
    to: string
    title?: string
    children: React.ReactNode
}

/**
 * How the indicator list links to admin pages. The admin provides its router's
 * `Link`; importing that into the list would bundle the admin's router into
 * the chart editor package, whose picker shows none of these links. Without
 * the admin, there is no page to link to, so the default shows just the text.
 */
export const VariableListLinkContext = createContext<
    (props: VariableListLinkProps) => React.ReactElement
>(({ children }) => <>{children}</>)
