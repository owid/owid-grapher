import { useCallback, useMemo, useRef, useState } from "react"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faCircleXmark,
    faMagnifyingGlass,
    faPencil,
} from "@fortawesome/free-solid-svg-icons"
import { Checkbox } from "@ourworldindata/components"

import { LabeledControl } from "../../../../components/Controls/Controls.js"

import type { Feed } from "../core/feed.js"
import type { EntityId, IndexKey } from "../core/types.js"
import { continentColor, SMALL_COUNTRY_POP } from "../core/constants.js"
import { useDismiss } from "./Popover.js"

interface CountryPickerProps {
    feed: Feed
    xKey: IndexKey
    year: number
    showSmallCountries: boolean
    selected: ReadonlySet<EntityId>
    onChange: (selected: Set<EntityId>) => void
}

/**
 * Grapher's entity selector, for several countries at once: a search field, the selection on top,
 * then every country A-Z. A country with no data this year (or below the population threshold) is
 * listed where it belongs alphabetically but greyed out and not selectable, so the list explains
 * itself rather than shrinking.
 */
export function CountryPicker({
    feed,
    xKey,
    year,
    showSmallCountries,
    selected,
    onChange,
}: CountryPickerProps): React.ReactElement {
    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState("")
    const containerRef = useRef<HTMLDivElement>(null)
    const searchRef = useRef<HTMLInputElement>(null)
    const close = useCallback(() => setIsOpen(false), [])
    useDismiss(containerRef, isOpen, close)

    const sortedIds = useMemo(
        () =>
            feed.entities
                .map((_, i) => i)
                .sort((a, b) =>
                    feed.entities[a].localeCompare(feed.entities[b])
                ),
        [feed]
    )
    const q = query.trim().toLowerCase()
    const matches = (eid: EntityId): boolean =>
        !q || feed.entities[eid].toLowerCase().includes(q)
    const available = (eid: EntityId): boolean =>
        feed.entityAvailable(eid, xKey, year, showSmallCountries)

    const selectedRows = sortedIds.filter((e) => selected.has(e) && matches(e))
    const restRows = sortedIds.filter((e) => !selected.has(e) && matches(e))

    const toggle = (eid: EntityId): void => {
        const next = new Set(selected)
        if (next.has(eid)) next.delete(eid)
        else next.add(eid)
        onChange(next)
    }

    const row = (eid: EntityId): React.ReactElement => {
        const ok = available(eid) || selected.has(eid)
        return (
            <li key={eid}>
                <div
                    className={cx("dd-selectable-entity", {
                        "dd-selectable-entity--muted": !ok,
                    })}
                >
                    <Checkbox
                        checked={selected.has(eid)}
                        disabled={!ok}
                        onChange={() => toggle(eid)}
                        label={
                            <>
                                <span
                                    className="dd-selectable-entity__swatch"
                                    style={{
                                        background: continentColor(
                                            feed.continentOf[eid]
                                        ),
                                    }}
                                />
                                {feed.entities[eid]}
                            </>
                        }
                    />
                    <span className="dd-selectable-entity__value">
                        {ok
                            ? feed.continentOf[eid]
                            : feed.passesPopulationFilter(
                                    eid,
                                    year,
                                    showSmallCountries
                                )
                              ? `No data in ${year}`
                              : `Under ${SMALL_COUNTRY_POP.toLocaleString("en-US")} people`}
                    </span>
                </div>
            </li>
        )
    }

    return (
        <LabeledControl label="Countries" className="dd-country-picker">
            <div ref={containerRef} className="dd-popover-anchor">
                <button
                    type="button"
                    className={cx("dd-menu-toggle", { active: isOpen })}
                    aria-haspopup="dialog"
                    aria-expanded={isOpen}
                    onClick={() => {
                        setIsOpen((open) => !open)
                        setTimeout(() => searchRef.current?.focus(), 0)
                    }}
                >
                    <FontAwesomeIcon icon={faPencil} />
                    <span>
                        {selected.size ? "Edit countries" : "Select countries"}
                    </span>
                    {selected.size > 0 && (
                        <span className="dd-menu-toggle__count">
                            {selected.size}
                        </span>
                    )}
                </button>
                {isOpen && (
                    <div
                        className="dd-entity-selector"
                        role="dialog"
                        aria-label="Select countries"
                    >
                        <div className="dd-entity-selector__search">
                            <div
                                className={cx("dd-search-field", {
                                    "has-value": !!query,
                                })}
                            >
                                <FontAwesomeIcon
                                    icon={faMagnifyingGlass}
                                    className="dd-search-field__icon"
                                />
                                <input
                                    ref={searchRef}
                                    type="search"
                                    value={query}
                                    placeholder="Search for a country"
                                    autoComplete="off"
                                    aria-label="Search for a country"
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            const first =
                                                restRows.find(available) ??
                                                selectedRows[0]
                                            if (first !== undefined) {
                                                e.preventDefault()
                                                toggle(first)
                                            }
                                        }
                                    }}
                                />
                                {query && (
                                    <button
                                        type="button"
                                        className="dd-search-field__clear"
                                        aria-label="Clear search"
                                        onClick={() => {
                                            setQuery("")
                                            searchRef.current?.focus()
                                        }}
                                    >
                                        <FontAwesomeIcon icon={faCircleXmark} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="dd-entity-selector__content">
                            {selectedRows.length > 0 && (
                                <div className="dd-entity-section">
                                    <div className="dd-entity-section__header">
                                        <span className="dd-entity-section__title">
                                            Selection ({selected.size})
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => onChange(new Set())}
                                        >
                                            Clear selection
                                        </button>
                                    </div>
                                    <ul>{selectedRows.map(row)}</ul>
                                </div>
                            )}
                            {restRows.length > 0 && (
                                <div className="dd-entity-section">
                                    <div className="dd-entity-section__header">
                                        <span className="dd-entity-section__title">
                                            {q
                                                ? "Matching countries"
                                                : "All countries"}{" "}
                                            ({restRows.length})
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const next = new Set(selected)
                                                restRows
                                                    .filter(available)
                                                    .forEach((e) => next.add(e))
                                                onChange(next)
                                            }}
                                        >
                                            Select {q ? "these" : "all"}
                                        </button>
                                    </div>
                                    <ul>{restRows.map(row)}</ul>
                                </div>
                            )}
                            {selectedRows.length === 0 &&
                                restRows.length === 0 && (
                                    <div className="dd-entity-selector__empty">
                                        No country matches "{query}"
                                    </div>
                                )}
                        </div>
                        <div className="dd-entity-selector__hint">
                            Selected countries are labeled in every panel; hover
                            any dot for its values.
                        </div>
                    </div>
                )}
            </div>
        </LabeledControl>
    )
}
