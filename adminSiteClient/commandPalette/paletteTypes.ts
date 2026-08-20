import { IconDefinition } from "@fortawesome/fontawesome-svg-core"
import { History } from "history"
import { Admin } from "../Admin.js"

export interface CommandContext {
    history: History
    admin: Admin
}

export type PaletteAction =
    /** Navigate to an SPA route via react-router (or a new tab if newTab) */
    | { label: string; to: string; newTab?: boolean }
    /** Navigate to a plain URL (full page load, or a new tab if external) */
    | { label: string; href: string; external?: boolean }
    /** Run arbitrary logic, e.g. a page-registered command */
    | { label: string; run: (ctx: CommandContext) => void }

export interface PaletteItem {
    id: string
    title: string
    subtitle?: string
    icon: IconDefinition
    /** actions[0] runs on Enter, actions[1] on cmd/ctrl+Enter */
    actions: PaletteAction[]
}

export interface PaletteSection {
    id: string
    label: string
    items: PaletteItem[]
}

/**
 * Items whose primary action is a navigation get a derived "Open in new tab"
 * secondary action unless they declare their own secondary.
 */
export function deriveActions(actions: PaletteAction[]): PaletteAction[] {
    if (actions.length !== 1) return actions
    const primary = actions[0]
    if ("to" in primary)
        return [
            primary,
            { label: "Open in new tab", to: primary.to, newTab: true },
        ]
    if ("href" in primary && !primary.external)
        return [
            primary,
            { label: "Open in new tab", href: primary.href, external: true },
        ]
    return actions
}
