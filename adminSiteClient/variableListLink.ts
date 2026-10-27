import * as React from "react"

export interface VariableListLinkProps {
    /** The admin page's path, under /admin */
    to: string
    title?: string
    children: React.ReactNode
}

/**
 * How the indicator list links to admin pages. The admin provides its router's
 * `Link`; importing that into the list would bundle the admin's router into
 * the chart editor package, whose picker shows none of these links.
 */
export const VariableListLinkContext = React.createContext<
    (props: VariableListLinkProps) => React.ReactElement
>(({ to, ...rest }) => React.createElement("a", { href: to, ...rest }))
