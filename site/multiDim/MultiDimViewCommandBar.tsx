import { Fragment, useEffect, useState } from "react"
import cx from "clsx"
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    Autocomplete,
    Dialog,
    Input,
    Menu,
    MenuItem,
    Modal,
    ModalOverlay,
    SearchField,
} from "react-aria-components"
import { tinykeys } from "tinykeys"
import type { MultiDimAllViewsView } from "./MultiDimAllViews.js"
import { highlightTokens, useViewSearch } from "./useViewSearch.js"

/**
 * "⌘K" on Apple devices, "Ctrl K" elsewhere, matching what tinykeys' $mod
 * means there; empty until mounted (SSR)
 */
export function useCommandBarShortcutLabel(): string {
    const [label, setLabel] = useState("")
    useEffect(
        () =>
            setLabel(
                /Mac|iPod|iPhone|iPad/.test(navigator.platform)
                    ? "⌘K"
                    : "Ctrl K"
            ),
        []
    )
    return label
}

/**
 * A Cmd+K / Ctrl+K command bar for switching between the views of a
 * multi-dim page. Searches the same way as the "All charts" list.
 */
export function MultiDimViewCommandBar({
    currentQueryStr,
    views,
    isOpen,
    onOpenChange,
    onSelectView,
}: {
    currentQueryStr: string
    views: MultiDimAllViewsView[]
    isOpen: boolean
    onOpenChange: (isOpen: boolean) => void
    onSelectView: (view: MultiDimAllViewsView) => void
}) {
    const [query, setQuery] = useState("")
    const { tokens, isSearching, matches } = useViewSearch(views, query)

    useEffect(
        () =>
            tinykeys(
                window,
                {
                    "$mod+k": (e) => {
                        e.preventDefault()
                        onOpenChange(!isOpen)
                    },
                },
                // Unlike the default, also listen inside text fields, so the
                // shortcut works from the list's search box and closes the
                // command bar again from its own
                { ignore: (e) => e.repeat || e.isComposing }
            ),
        [isOpen, onOpenChange]
    )

    // Start afresh each time
    useEffect(() => {
        if (!isOpen) setQuery("")
    }, [isOpen])

    const visibleViews = isSearching ? views.filter(matches) : views

    const handleAction = (view: MultiDimAllViewsView): void => {
        onOpenChange(false)
        // Wait for the modal to unmount and release its scroll lock, so
        // that scrolling up to the chart works
        setTimeout(() => onSelectView(view), 0)
    }

    return (
        <ModalOverlay
            className="view-command-bar-overlay"
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            isDismissable
        >
            <Modal className="view-command-bar-modal">
                <Dialog
                    className="view-command-bar"
                    aria-label="Switch to another chart on this page"
                >
                    <Autocomplete inputValue={query} onInputChange={setQuery}>
                        <SearchField
                            className="view-command-bar__search"
                            aria-label="Search the charts on this page"
                            autoFocus
                        >
                            <FontAwesomeIcon
                                className="view-command-bar__search-icon"
                                icon={faMagnifyingGlass}
                            />
                            <Input
                                className="view-command-bar__input"
                                placeholder={`Search ${views.length} charts…`}
                            />
                        </SearchField>
                        <Menu
                            className="view-command-bar__list"
                            aria-label="Charts on this page"
                            renderEmptyState={() => (
                                <p className="view-command-bar__empty">
                                    No charts match “{query.trim()}”.
                                </p>
                            )}
                        >
                            {visibleViews.map((view) => {
                                const isCurrent =
                                    view.queryStr === currentQueryStr
                                return (
                                    <MenuItem
                                        key={view.queryStr}
                                        id={view.queryStr}
                                        textValue={view.title}
                                        className={cx(
                                            "view-command-bar__item",
                                            {
                                                "view-command-bar__item--current":
                                                    isCurrent,
                                            }
                                        )}
                                        onAction={() => handleAction(view)}
                                    >
                                        <span className="view-command-bar__item-title">
                                            {highlightTokens(
                                                view.title,
                                                tokens
                                            )}
                                            {isCurrent && (
                                                <span className="view-command-bar__current-label">
                                                    Currently shown
                                                </span>
                                            )}
                                        </span>
                                        <span className="view-command-bar__item-meta">
                                            {view.choices.map((c, i) => (
                                                <Fragment
                                                    key={c.dimensionName}
                                                >
                                                    {i > 0 && (
                                                        <span
                                                            className="view-command-bar__item-meta-sep"
                                                            aria-hidden="true"
                                                        >
                                                            ·
                                                        </span>
                                                    )}
                                                    {highlightTokens(
                                                        c.choiceName,
                                                        tokens
                                                    )}
                                                </Fragment>
                                            ))}
                                        </span>
                                    </MenuItem>
                                )
                            })}
                        </Menu>
                    </Autocomplete>
                    <div
                        className="view-command-bar__footer"
                        aria-hidden="true"
                    >
                        <span>
                            <kbd>↑</kbd>
                            <kbd>↓</kbd> to navigate
                        </span>
                        <span>
                            <kbd>↵</kbd> to show chart
                        </span>
                        <span>
                            <kbd>esc</kbd> to close
                        </span>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    )
}
