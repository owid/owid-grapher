import { useEffect } from "react"
import cx from "classnames"

interface AsDraftProps {
    name?: string
    className?: string
    children: React.ReactNode
}

export const AsDraft = ({ name, className, children }: AsDraftProps) => {
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

    if (name) {
        return (
            <fieldset className={cx("as-draft", className)}>
                <legend className="as-draft__legend">{name}</legend>
                {children}
            </fieldset>
        )
    }

    return <div className={cx("as-draft", className)}>{children}</div>
}
