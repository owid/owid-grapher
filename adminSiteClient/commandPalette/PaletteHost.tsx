import * as React from "react"
import { useCallback, useContext, useEffect, useState } from "react"
import { useHistory } from "react-router-dom"
import { AdminAppContext } from "../AdminAppContext.js"
import { registerBuiltinCommands } from "./registerBuiltinCommands.js"
import { recordRecent } from "./recents.js"
import { PaletteAction, PaletteItem } from "./paletteTypes.js"
import { GlobalPalette } from "./GlobalPalette.js"

/**
 * Hosts the admin command palette: registers the built-in commands, owns the
 * global keyboard shortcuts (cmd/ctrl+K opens search, cmd/ctrl+shift+K opens
 * command mode, i.e. the same palette with ">" pre-typed) and executes the
 * selected item's action.
 */
export function PaletteHost(): React.ReactElement {
    const { admin } = useContext(AdminAppContext)
    const history = useHistory()
    const [isOpen, setIsOpen] = useState(false)
    const [inputValue, setInputValue] = useState("")

    useEffect(() => registerBuiltinCommands(), [])

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            const isModK =
                (event.metaKey || event.ctrlKey) &&
                !event.altKey &&
                event.key.toLowerCase() === "k"
            if (!isModK) return
            event.preventDefault()
            event.stopPropagation()
            const wantCommandMode = event.shiftKey
            const isInCommandMode = inputValue.startsWith(">")
            if (isOpen && wantCommandMode === isInCommandMode) {
                // pressing the shortcut of the mode we're in toggles closed
                setIsOpen(false)
            } else {
                setIsOpen(true)
                setInputValue(wantCommandMode ? ">" : "")
            }
        }
        // Capture phase so the shortcut works from anywhere, including
        // focused inputs and CodeMirror editors
        document.addEventListener("keydown", onKeyDown, true)
        return () => document.removeEventListener("keydown", onKeyDown, true)
    }, [isOpen, inputValue])

    const executeAction = useCallback(
        (action: PaletteAction): void => {
            if ("run" in action) {
                action.run({ history, admin })
            } else if ("to" in action) {
                if (action.newTab) window.open(admin.url(action.to), "_blank")
                else history.push(action.to)
            } else {
                if (action.external) window.open(action.href, "_blank")
                else window.location.assign(action.href)
            }
        },
        [history, admin]
    )

    const onSelect = useCallback(
        (item: PaletteItem, actionIndex: number): void => {
            const action =
                item.actions[actionIndex] ?? item.actions[0]
            if (!action) return
            recordRecent({
                id: item.id,
                title: item.title,
                subtitle: item.subtitle,
                kind: item.id.includes(":")
                    ? item.id.split(":")[0]
                    : "command",
                ...("to" in item.actions[0] && { to: item.actions[0].to }),
                ...("href" in item.actions[0] && {
                    href: item.actions[0].href,
                }),
            })
            // Close first so anything the action opens (dialogs, focus)
            // isn't fighting the palette's focus management
            setIsOpen(false)
            executeAction(action)
        },
        [executeAction]
    )

    return (
        <GlobalPalette
            isOpen={isOpen}
            inputValue={inputValue}
            onInputChange={setInputValue}
            onClose={() => setIsOpen(false)}
            onSelect={onSelect}
        />
    )
}
