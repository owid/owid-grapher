import * as React from "react"
import { useContext, useMemo } from "react"
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query"
import { faStar, faTerminal } from "@fortawesome/free-solid-svg-icons"
import { FuzzySearch } from "@ourworldindata/utils"
import { useDebounceValue } from "usehooks-ts"
import { AdminAppContext } from "../AdminAppContext.js"
import {
    chartRedirectsQuery,
    chartsQuery,
    dataInsightsQuery,
    datasetsQuery,
    dodsQuery,
    explorersQuery,
    filesQuery,
    gdocsQuery,
    imagesQuery,
    indicatorSearchQuery,
    multiDimRedirectsQuery,
    multiDimsQuery,
    narrativeChartsQuery,
    siteRedirectsQuery,
    slideshowsQuery,
    staticVizQuery,
    tagsQuery,
    usersQuery,
} from "../queries.js"
import { Admin } from "../Admin.js"
import { AdminCommand, COMMAND_CATEGORY_ORDER } from "./commandRegistry.js"
import { useCommandRegistry } from "./commandRegistryReact.js"
import { getRecents } from "./recents.js"
import { deriveActions, PaletteItem, PaletteSection } from "./paletteTypes.js"
import { fallbackSection, rankResults, SourceData } from "./paletteSources.js"
import { PaletteShell } from "./PaletteShell.js"

const FUZZY_OPTIONS = { threshold: 0.5 }
const MAX_RECENTS_SHOWN = 5
const DEBOUNCE_MS = 150
const MIN_SERVER_QUERY_LENGTH = 2
const INDICATOR_LIMIT = 5
/** Collections are stable enough that a few minutes of staleness is fine */
const STALE_TIME = 5 * 60 * 1000

/** Client-side sources: fetched whole, then fuzzy-matched in the browser. */
function clientSourceQueries(admin: Admin, enabled: boolean) {
    const quiet = { quiet: true }
    const entries = [
        ["charts", chartsQuery(admin, quiet)],
        ["gdocs", gdocsQuery(admin, quiet)],
        ["dataInsights", dataInsightsQuery(admin, quiet)],
        ["narrativeCharts", narrativeChartsQuery(admin, quiet)],
        ["multiDims", multiDimsQuery(admin, quiet)],
        ["explorers", explorersQuery(admin, quiet)],
        ["datasets", datasetsQuery(admin, quiet)],
        ["dods", dodsQuery(admin, quiet)],
        ["images", imagesQuery(admin, quiet)],
        ["files", filesQuery(admin, quiet)],
        ["staticViz", staticVizQuery(admin, quiet)],
        ["slideshows", slideshowsQuery(admin, quiet)],
        ["tags", tagsQuery(admin, quiet)],
        ["users", usersQuery(admin, quiet)],
        ["chartRedirects", chartRedirectsQuery(admin, quiet)],
        ["siteRedirects", siteRedirectsQuery(admin, quiet)],
        ["multiDimRedirects", multiDimRedirectsQuery(admin, quiet)],
    ] as const
    return {
        sourceIds: entries.map(([id]) => id),
        queries: entries.map(([, options]) => ({
            ...options,
            enabled,
            staleTime: STALE_TIME,
        })),
    }
}

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
    const { admin } = useContext(AdminAppContext)
    const commands = useCommandRegistry()

    const isCommandMode = inputValue.startsWith(">")
    const query = (isCommandMode ? inputValue.slice(1) : inputValue).trim()
    // Client-side matching runs on every keystroke: fuzzysort over prepared
    // targets is sub-millisecond, and debouncing it would replace the result
    // collection after react-aria has already moved focus to the first item,
    // losing that focus. Only the server-side indicator query is debounced.
    const [debouncedQuery] = useDebounceValue(query, DEBOUNCE_MS)

    // Content sources are only needed in search mode
    const wantContent = isOpen && !isCommandMode
    const { sourceIds, queries } = useMemo(
        () => clientSourceQueries(admin, wantContent),
        [admin, wantContent]
    )
    const results = useQueries({ queries })

    const { data: indicators } = useQuery({
        ...indicatorSearchQuery(admin, debouncedQuery, INDICATOR_LIMIT, {
            quiet: true,
        }),
        enabled:
            wantContent && debouncedQuery.length >= MIN_SERVER_QUERY_LENGTH,
        placeholderData: keepPreviousData,
        staleTime: STALE_TIME,
    })

    const sourceData = useMemo((): SourceData => {
        const data: SourceData = {}
        sourceIds.forEach((id, index) => {
            const rows = results[index]?.data
            if (Array.isArray(rows)) data[id] = rows
        })
        if (indicators?.length) data.indicators = indicators
        return data
        // results is a new array identity each render; its contents are what matter
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceIds, indicators, ...results.map((result) => result.data)])

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
        if (isCommandMode)
            return groupCommandsByCategory(
                query ? commandSearch.search(query) : commands
            )

        if (!query) {
            const recentItems = getRecents()
                .filter((recent) => recent.kind === "command")
                .map((recent) => commands.find((c) => c.id === recent.id))
                .filter((command) => command !== undefined)
                .slice(0, MAX_RECENTS_SHOWN)
                .map(commandToItem)
            const recentSections: PaletteSection[] = recentItems.length
                ? [
                      {
                          id: "recent",
                          label: "Recent",
                          items: recentItems,
                      },
                  ]
                : []
            return [...recentSections, ...groupCommandsByCategory(commands)]
        }

        const { topHit, sections: contentSections } = rankResults({
            data: sourceData,
            query,
            preSearchedSourceIds: ["indicators"],
        })
        const topHitSection: PaletteSection[] = topHit
            ? [
                  {
                      id: "top-hit",
                      label: "Top hit",
                      items: [{ ...topHit, icon: topHit.icon ?? faStar }],
                  },
              ]
            : []
        const commandSections = groupCommandsByCategory(
            commandSearch.search(query)
        )
        const allSections = [
            ...topHitSection,
            ...contentSections,
            ...commandSections,
        ]
        if (allSections.length) return allSections

        const fallback = fallbackSection(query)
        return fallback ? [fallback] : []
    }, [isCommandMode, query, commands, commandSearch, sourceData])

    const isLoadingSources =
        wantContent && !!query && results.some((result) => result.isLoading)

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
            emptyMessage={
                isLoadingSources
                    ? "Loading…"
                    : `No results for "${query || inputValue}"`
            }
            footerHint={isCommandMode ? undefined : "⌘⇧K for commands"}
        />
    )
}
