import { useState } from "react"
import { copyToClipboard } from "@ourworldindata/utils"
import { CookieKey } from "@ourworldindata/grapher"
import { useIsClient } from "usehooks-ts"

export function CopySocialButton() {
    const isClient = useIsClient()
    const [label, setLabel] = useState("Copy for social")

    if (!isClient) return null
    try {
        if (!document.cookie.includes(CookieKey.isAdmin)) return null
    } catch {
        return null
    }

    function handleClick() {
        const title =
            document.querySelector<HTMLElement>(
                ".data-insight-body .display-3-semibold"
            )?.innerText ?? ""

        const bodyEl = document.querySelector<HTMLElement>(
            ".data-insight-blocks"
        )
        // innerText preserves paragraph breaks but strips HTML
        let body = bodyEl?.innerText ?? ""

        // The CTA renders inside .data-insight-blocks as a .cta element.
        // Remove its text from the body so we can format it separately.
        const ctaEl = bodyEl?.querySelector<HTMLElement>(".cta")
        const ctaLinkEl = ctaEl?.querySelector<HTMLAnchorElement>("a")
        if (ctaEl && body.includes(ctaEl.innerText)) {
            body = body.replace(ctaEl.innerText, "").trimEnd()
        }

        const authorEls = document.querySelectorAll<HTMLElement>(
            ".data-insight-author"
        )
        const authors = Array.from(authorEls).map((el) =>
            el.innerText.trim()
        )

        const parts = [title, body]

        if (authors.length === 1) {
            parts.push(
                `(This Data Insight was written by ${authors[0]}.)`
            )
        } else if (authors.length === 2) {
            parts.push(
                `(This Data Insight was written by ${authors[0]} and ${authors[1]}.)`
            )
        } else if (authors.length > 2) {
            const last = authors.pop()
            parts.push(
                `(This Data Insight was written by ${authors.join(", ")}, and ${last}.)`
            )
        }

        if (ctaLinkEl) {
            const ctaText = ctaLinkEl.innerText.trim()
            const ctaUrl = ctaLinkEl.href
            parts.push(`${ctaText}: ${ctaUrl}`)
        }

        void copyToClipboard(parts.join("\n\n"))
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
