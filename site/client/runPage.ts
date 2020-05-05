import tippy from "tippy.js"

export default function runPage() {
    document.querySelector("html")?.classList.add("js")

    if (
        document.cookie.includes("wordpress") ||
        document.cookie.includes("wp-settings") ||
        document.cookie.includes("isAdmin")
    ) {
        const adminbar = document.getElementById("wpadminbar")
        if (adminbar) adminbar.style.display = ""
    }

    const tooltips = document.querySelectorAll("a.ref sup")

    tippy(tooltips, {
        appendTo: () => document.body,
        allowHTML: true,
        content: el => {
            const referencedId = el.closest("a.ref")?.getAttribute("href")
            if (!referencedId) return ""
            const referencedEl = document.querySelector(referencedId)
            return referencedEl?.innerHTML ?? ""
        },
        interactive: true,
        theme: "owid-reference",
        placement: "auto"
    })
}
