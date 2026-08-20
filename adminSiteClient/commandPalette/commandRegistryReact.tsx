import { useEffect, useSyncExternalStore } from "react"
import { AdminCommand, commandRegistry } from "./commandRegistry.js"

/** All currently registered commands; re-renders on registry changes. */
export function useCommandRegistry(): AdminCommand[] {
    return useSyncExternalStore(commandRegistry.subscribe, commandRegistry.getAll)
}

/**
 * Register commands for as long as the calling component is mounted.
 * Pass a stable (memoized) array where possible — a new array identity on
 * every render re-registers on every render, which works but is wasteful.
 */
export function usePageCommands(commands: AdminCommand[]): void {
    useEffect(() => commandRegistry.register(commands), [commands])
}

/**
 * Register commands for as long as this component is rendered. For use in
 * MobX class components, which can't call hooks: render
 * `<PageCommands commands={...} />` anywhere in the page's JSX and MobX
 * re-renders keep the registered commands up to date.
 */
export function PageCommands({
    commands,
}: {
    commands: AdminCommand[]
}): null {
    usePageCommands(commands)
    return null
}
