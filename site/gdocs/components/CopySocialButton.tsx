import { useState } from "react"
import { copyToClipboard } from "@ourworldindata/utils"
import { CookieKey } from "@ourworldindata/grapher"
import { useIsClient } from "usehooks-ts"

export function CopySocialButton({ text }: { text: string }) {
    const isClient = useIsClient()
    const [label, setLabel] = useState("Copy for social")

    if (!isClient) return null
    try {
        if (!document.cookie.includes(CookieKey.isAdmin)) return null
    } catch {
        return null
    }

    function handleClick() {
        void copyToClipboard(text)
        setLabel("Copied!")
        setTimeout(() => setLabel("Copy for social"), 1000)
    }

    return (
        <a
            href="#"
            className="data-insight-copy-link-button body-3-medium"
            onClick={(e) => {
                e.preventDefault()
                handleClick()
            }}
        >
            {label}
        </a>
    )
}
