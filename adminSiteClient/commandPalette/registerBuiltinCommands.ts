import {
    ADMIN_CREATE_ACTIONS,
    ADMIN_NAV_SECTIONS,
    AdminNavEntry,
} from "../adminNav.js"
import {
    AdminCommand,
    COMMAND_CATEGORIES,
    commandRegistry,
    Disposable,
} from "./commandRegistry.js"

function slugify(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "-")
}

function navEntryToCommand(
    entry: AdminNavEntry,
    category: string,
    idPrefix: string
): AdminCommand {
    return {
        id: `${idPrefix}.${slugify(entry.title)}`,
        title: entry.title,
        category,
        icon: entry.icon,
        actions: entry.to
            ? [{ label: "Open", to: entry.to }]
            : [
                  {
                      label: "Open",
                      href: entry.href ?? "/",
                      external: entry.external,
                  },
              ],
    }
}

function flattenNavEntries(): AdminNavEntry[] {
    return ADMIN_NAV_SECTIONS.flatMap((section) =>
        section.entries.flatMap((entry) => [entry, ...(entry.children ?? [])])
    )
}

/** Register the global navigation and create commands. Called once at app startup. */
export function registerBuiltinCommands(): Disposable {
    const navCommands = flattenNavEntries().map((entry) =>
        navEntryToCommand(entry, COMMAND_CATEGORIES.pages, "nav")
    )
    const createCommands = ADMIN_CREATE_ACTIONS.map((entry) =>
        navEntryToCommand(entry, COMMAND_CATEGORIES.create, "create")
    )
    return commandRegistry.register([...navCommands, ...createCommands])
}
