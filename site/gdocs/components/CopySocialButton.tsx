import { useState } from "react"
import cx from "clsx"
import { copyToClipboard } from "@ourworldindata/utils"
import { CookieKey } from "@ourworldindata/grapher"
import { useIsClient } from "usehooks-ts"

export function CopySocialButton({
    text,
    className,
}: {
    text: string
    className?: string
}) {
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
            className={cx("body-3-medium", className)}
            onClick={(e) => {
                e.preventDefault()
                handleClick()
            }}
        >
            {label}
        </a>
    )
}
