import * as React from "react"
import { useCallback, useRef } from "react"
import {
    Autocomplete,
    Dialog,
    Header,
    Input,
    Menu,
    MenuItem,
    MenuSection,
    Modal,
    ModalOverlay,
    SearchField,
} from "react-aria-components"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { PaletteItem, PaletteSection } from "./paletteTypes.js"

const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform)
const MOD_KEY_LABEL = isMac ? "⌘" : "Ctrl+"

export interface PaletteShellProps {
    isOpen: boolean
    onClose: () => void
    inputValue: string
    onInputChange: (value: string) => void
    placeholder: string
    sections: PaletteSection[]
    /** actionIndex 0 = Enter/click, 1 = cmd/ctrl+Enter */
    onSelect: (item: PaletteItem, actionIndex: number) => void
    emptyMessage: string
    footerHint?: string
}

export function PaletteShell({
    isOpen,
    onClose,
    inputValue,
    onInputChange,
    placeholder,
    sections,
    onSelect,
    emptyMessage,
    footerHint,
}: PaletteShellProps): React.ReactElement {
    const dialogRef = useRef<HTMLDivElement>(null)

    const findItem = useCallback(
        (id: string): PaletteItem | undefined => {
            for (const section of sections) {
                const item = section.items.find((i) => i.id === id)
                if (item) return item
            }
            return undefined
        },
        [sections]
    )

    const handleAction = useCallback(
        (key: React.Key) => {
            const item = findItem(String(key))
            if (item) onSelect(item, 0)
        },
        [findItem, onSelect]
    )

    // cmd/ctrl+Enter runs the focused item's secondary action. RAC only
    // handles plain Enter, so we intercept the modified chord ourselves and
    // resolve the (virtually) focused item through its data attributes.
    const handleKeyDownCapture = useCallback(
        (event: React.KeyboardEvent) => {
            if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey))
                return
            const focusedElement = dialogRef.current?.querySelector(
                "[data-focused][data-palette-id]"
            )
            const paletteId = focusedElement?.getAttribute("data-palette-id")
            if (!paletteId) return
            const item = findItem(paletteId)
            if (!item) return
            event.preventDefault()
            event.stopPropagation()
            onSelect(item, 1)
        },
        [findItem, onSelect]
    )

    return (
        <ModalOverlay
            className="command-palette__overlay"
            isOpen={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose()
            }}
            isDismissable
        >
            <Modal className="command-palette">
                <Dialog
                    aria-label="Command palette"
                    className="command-palette__dialog"
                >
                    <div
                        ref={dialogRef}
                        className="command-palette__body"
                        onKeyDownCapture={handleKeyDownCapture}
                    >
                        <Autocomplete
                            inputValue={inputValue}
                            onInputChange={onInputChange}
                            filter={() => true}
                        >
                            <SearchField
                                aria-label="Search"
                                className="command-palette__field"
                            >
                                <Input
                                    className="command-palette__input"
                                    placeholder={placeholder}
                                    autoFocus
                                />
                            </SearchField>
                            <Menu
                                className="command-palette__menu"
                                aria-label="Results"
                                // ranking happens upstream, so RAC never sees a
                                // filter operation and won't focus the first item
                                // on its own
                                autoFocus="first"
                                onAction={handleAction}
                                renderEmptyState={() => (
                                    <div className="command-palette__empty">
                                        {emptyMessage}
                                    </div>
                                )}
                            >
                                {sections.map((section) => (
                                    <MenuSection
                                        key={section.id}
                                        id={section.id}
                                        className="command-palette__section"
                                    >
                                        <Header className="command-palette__section-header">
                                            {section.label}
                                        </Header>
                                        {section.items.map((item) => (
                                            <MenuItem
                                                key={item.id}
                                                id={item.id}
                                                textValue={item.title}
                                                className="command-palette__item"
                                                data-palette-id={item.id}
                                            >
                                                <FontAwesomeIcon
                                                    icon={item.icon}
                                                    fixedWidth
                                                    className="command-palette__item-icon"
                                                />
                                                <span className="command-palette__item-title">
                                                    {item.title}
                                                </span>
                                                {item.subtitle && (
                                                    <span className="command-palette__item-subtitle">
                                                        {item.subtitle}
                                                    </span>
                                                )}
                                            </MenuItem>
                                        ))}
                                    </MenuSection>
                                ))}
                            </Menu>
                        </Autocomplete>
                        <div className="command-palette__footer">
                            <span>↵ open</span>
                            <span>{MOD_KEY_LABEL}↵ new tab</span>
                            <span>esc close</span>
                            {footerHint && <span>{footerHint}</span>}
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    )
}
