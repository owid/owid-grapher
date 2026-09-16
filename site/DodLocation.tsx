import { type ReactNode } from "react"

/**
 * Marks a page region for details-on-demand attribution (see getDodLocation).
 * `display: contents`, so it adds no layout box.
 */
export default function DodLocation({
    location,
    children,
}: {
    location: string
    children: ReactNode
}) {
    return (
        <div data-dod-location={location} style={{ display: "contents" }}>
            {children}
        </div>
    )
}
