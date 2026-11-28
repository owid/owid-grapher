import { createRoot } from "react-dom/client"
import { get as getCookie } from "es-cookie"
import { CookieKey } from "@ourworldindata/grapher"
import { isInIFrame } from "@ourworldindata/utils"
import { ENV } from "../../settings/clientSettings.mjs"
import { LabsSwitch } from "./LabsSwitch.js"

function hasAdminCookie(): boolean {
    try {
        return !!getCookie(CookieKey.isAdmin)
    } catch {
        // Cookie access can be restricted by iframe sandboxing
        return false
    }
}

export function runLabsSwitch(): void {
    // Production only, and only for staff: the isAdmin cookie is set when
    // someone uses the admin. Labs has its own bar, and embedded charts load
    // this bundle too.
    if (ENV !== "production" || isInIFrame() || !hasAdminCookie()) return

    const container = document.createElement("div")
    document.body.appendChild(container)
    createRoot(container).render(<LabsSwitch />)
}
