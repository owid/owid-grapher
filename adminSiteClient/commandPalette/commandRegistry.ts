import { IconDefinition } from "@fortawesome/fontawesome-svg-core"
import { PaletteAction } from "./paletteTypes.js"

/**
 * A flat registry of commands, VSCode-style: the command palette is a pure
 * view over it. Global commands (navigation, create actions) are registered
 * once at app startup; pages contribute contextual commands on mount and
 * dispose them on unmount, so whatever is registered is always executable.
 */

export const COMMAND_CATEGORIES = {
    thisPage: "This page",
    pages: "Pages",
    create: "Create",
} as const

/** Display order of command categories in the palette */
export const COMMAND_CATEGORY_ORDER: string[] = [
    COMMAND_CATEGORIES.thisPage,
    COMMAND_CATEGORIES.pages,
    COMMAND_CATEGORIES.create,
]

export interface AdminCommand {
    /** Stable, unique id, e.g. "nav.charts" or "chart-editor.publish" */
    id: string
    title: string
    /** Palette section this command appears under */
    category: string
    icon?: IconDefinition
    /** actions[0] runs on Enter, actions[1] on cmd/ctrl+Enter */
    actions: PaletteAction[]
}

export type Disposable = () => void

class CommandRegistry {
    private registrations = new Map<number, AdminCommand[]>()
    private nextRegistrationId = 1
    private listeners = new Set<() => void>()
    private snapshot: AdminCommand[] = []

    register(commands: AdminCommand[]): Disposable {
        const registrationId = this.nextRegistrationId++
        this.registrations.set(registrationId, commands)
        this.rebuildSnapshot()
        return () => {
            if (this.registrations.delete(registrationId))
                this.rebuildSnapshot()
        }
    }

    /** Returns a stable snapshot, suitable for useSyncExternalStore */
    getAll = (): AdminCommand[] => {
        return this.snapshot
    }

    subscribe = (listener: () => void): Disposable => {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    private rebuildSnapshot(): void {
        this.snapshot = [...this.registrations.values()].flat()
        this.listeners.forEach((listener) => listener())
    }
}

export const commandRegistry = new CommandRegistry()

/** Exported for tests only */
export const createCommandRegistryForTesting = (): CommandRegistry =>
    new CommandRegistry()
