import * as React from "react"
import { useMemo } from "react"
import { faTerminal } from "@fortawesome/free-solid-svg-icons"
import { FuzzySearch } from "@ourworldindata/utils"
import {
    AdminCommand,
    COMMAND_CATEGORY_ORDER,
} from "./commandRegistry.js"
import { useCommandRegistry } from "./commandRegistryReact.js"
import { getRecents } from "./recents.js"
import {
    deriveActions,
    PaletteItem,
    PaletteSection,
} from "./paletteTypes.js"
import { PaletteShell } from "./PaletteShell.js"

const FUZZY_OPTIONS = { threshold: 0.75 }
const MAX_RECENTS_SHOWN = 5

function commandToItem(command: AdminCommand): PaletteItem {
    return {
        id: command.id,
        title: command.title,
        icon: command.icon ?? faTerminal,
        actions: deriveActions(command.actions),
    }
}

function groupCommandsByCategory(commands: AdminCommand[]): PaletteSection[] {
    const categories = [
        ...COMMAND_CATEGORY_ORDER,
        ...commands
            .map((command) => command.category)
            .filter((category) => !COMMAND_CATEGORY_ORDER.includes(category)),
    ]
    return categories
        .map((category) => ({
            id: `category-${category}`,
            label: category,
            items: commands
                .filter((command) => command.category === category)
                .map(commandToItem),
        }))
        .filter((section) => section.items.length > 0)
}

export interface GlobalPaletteProps {
    isOpen: boolean
    inputValue: string
    onInputChange: (value: string) => void
    onClose: () => void
    onSelect: (item: PaletteItem, actionIndex: number) => void
}

export function GlobalPalette({
    isOpen,
    inputValue,
    onInputChange,
    onClose,
    onSelect,
}: GlobalPaletteProps): React.ReactElement {
    const commands = useCommandRegistry()

    const isCommandMode = inputValue.startsWith(">")
    const query = (
        isCommandMode ? inputValue.slice(1) : inputValue
    ).trim()

    const commandSearch = useMemo(
        () =>
            FuzzySearch.withKey(
                commands,
                (command) => command.title,
                FUZZY_OPTIONS
            ),
        [commands]
    )

    const sections = useMemo((): PaletteSection[] => {
        if (query) return groupCommandsByCategory(commandSearch.search(query))

        const allSections = groupCommandsByCategory(commands)
        if (isCommandMode) return allSections

        // Empty query: recently used items first (only registry-resolvable
        // ones, so page commands from other pages don't show up)
        const recentItems = getRecents()
            .filter((recent) => recent.kind === "command")
            .map((recent) => commands.find((c) => c.id === recent.id))
            .filter((command) => command !== undefined)
            .slice(0, MAX_RECENTS_SHOWN)
            .map(commandToItem)
        const recentSections: PaletteSection[] = recentItems.length
            ? [{ id: "recent", label: "Recent", items: recentItems }]
            : []
        return [...recentSections, ...allSections]
    }, [query, isCommandMode, commands, commandSearch])

    return (
        <PaletteShell
            isOpen={isOpen}
            onClose={onClose}
            inputValue={inputValue}
            onInputChange={onInputChange}
            placeholder={
                isCommandMode
                    ? "Type a command…"
                    : "Search the admin… (type > for commands)"
            }
            sections={sections}
            onSelect={onSelect}
            emptyMessage={`No results for "${query}"`}
        />
    )
}
