import { useEffect } from "react"
import cx from "classnames"
import { useSearchDebugContext } from "./SearchDebugContext.js"

interface DebugInfo {
    tags?: string[]
    query?: string
}

interface SearchAsDraftProps {
    name: string
    className?: string
    children: React.ReactNode
    debug?: DebugInfo
}

const DEBUG_LABELS: Record<keyof DebugInfo, string> = {
    query: "Query",
    tags: "Tags",
}

export const SearchAsDraft = ({
    name,
    className,
    children,
    debug,
}: SearchAsDraftProps) => {
    const { isZenMode } = useSearchDebugContext()

    useEffect(() => {
        // Add Google Fonts to document head
        const preconnect1 = document.createElement("link")
        preconnect1.rel = "preconnect"
        preconnect1.href = "https://fonts.googleapis.com"

        const preconnect2 = document.createElement("link")
        preconnect2.rel = "preconnect"
        preconnect2.href = "https://fonts.gstatic.com"
        preconnect2.crossOrigin = "anonymous"

        const fontLink = document.createElement("link")
        fontLink.href =
            "https://fonts.googleapis.com/css2?family=Gochi+Hand&display=swap"
        fontLink.rel = "stylesheet"

        // Check if links already exist to avoid duplicates
        if (
            !document.querySelector('link[href="https://fonts.googleapis.com"]')
        ) {
            document.head.appendChild(preconnect1)
        }
        if (!document.querySelector('link[href="https://fonts.gstatic.com"]')) {
            document.head.appendChild(preconnect2)
        }
        if (!document.querySelector('link[href*="Gochi Hand"]')) {
            document.head.appendChild(fontLink)
        }
    }, [])

    const renderDebugInfo = () => {
        if (!debug) return null

        const debugEntries = Object.entries(debug).filter(([_, value]) => {
            if (Array.isArray(value)) {
                return value.length > 0
            }
            return value !== undefined && value !== null && value !== ""
        })

        if (debugEntries.length === 0) return null

        return (
            <div className="search-as-draft__debug">
                {debugEntries.map(([key, value]) => (
                    <div key={key} className="search-as-draft__debug-item">
                        <strong>{DEBUG_LABELS[key as keyof DebugInfo]}:</strong>{" "}
                        {Array.isArray(value) ? value.join(", ") : value}
                    </div>
                ))}
            </div>
        )
    }

    return (
        <fieldset
            className={cx("search-as-draft", className, {
                "search-as-draft--zen": isZenMode,
            })}
        >
            <legend className="search-as-draft__legend">{name}</legend>
            {renderDebugInfo()}
            {children}
        </fieldset>
    )
}
