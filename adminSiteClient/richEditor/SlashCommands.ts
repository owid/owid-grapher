import { Editor, Extension, Range } from "@tiptap/core"
import Suggestion, { SuggestionProps } from "@tiptap/suggestion"
import {
    RichEditorBlockItem,
    filterBlockItems,
} from "./blockRegistry.js"

// "/" opens an inline block inserter at the caret. Rendered with plain DOM
// (no popper dependency); keyboard navigation via up/down/enter/escape.

export interface SlashCommandsOptions {
    onRequestImage: (insert: (filename: string) => void) => void
}

interface SlashMenuState {
    element: HTMLDivElement
    items: RichEditorBlockItem[]
    selectedIndex: number
    props: SuggestionProps<RichEditorBlockItem>
}

function executeItem(
    item: RichEditorBlockItem,
    editor: Editor,
    range: Range,
    options: SlashCommandsOptions
): void {
    item.command({ editor, range, onRequestImage: options.onRequestImage })
}

function renderMenu(state: SlashMenuState, options: SlashCommandsOptions): void {
    const { element, items, selectedIndex, props } = state
    element.replaceChildren()
    if (items.length === 0) {
        const empty = document.createElement("div")
        empty.className = "rich-slash-menu__empty"
        empty.textContent = "No matching blocks"
        element.appendChild(empty)
        return
    }
    items.forEach((item, index) => {
        const button = document.createElement("button")
        button.type = "button"
        button.className = "rich-slash-menu__item"
        if (index === selectedIndex) {
            button.classList.add("rich-slash-menu__item--selected")
        }
        const glyph = document.createElement("span")
        glyph.className = "rich-slash-menu__glyph"
        glyph.textContent = item.glyph
        const label = document.createElement("span")
        label.className = "rich-slash-menu__label"
        label.textContent = item.title
        const description = document.createElement("span")
        description.className = "rich-slash-menu__description"
        description.textContent = item.description
        button.append(glyph, label, description)
        button.addEventListener("mousedown", (event) => {
            event.preventDefault()
            executeItem(item, props.editor, props.range, options)
        })
        element.appendChild(button)
    })
}

function positionMenu(state: SlashMenuState): void {
    const rect = state.props.clientRect?.()
    if (!rect) return
    const { element } = state
    element.style.position = "fixed"
    element.style.left = `${rect.left}px`
    const spaceBelow = window.innerHeight - rect.bottom
    if (spaceBelow < 320) {
        element.style.top = "auto"
        element.style.bottom = `${window.innerHeight - rect.top + 4}px`
    } else {
        element.style.bottom = "auto"
        element.style.top = `${rect.bottom + 4}px`
    }
}

export const SlashCommands = Extension.create<SlashCommandsOptions>({
    name: "slashCommands",

    addOptions() {
        return {
            onRequestImage: () => undefined,
        }
    },

    addProseMirrorPlugins() {
        const options = this.options
        let state: SlashMenuState | undefined

        return [
            Suggestion<RichEditorBlockItem>({
                editor: this.editor,
                char: "/",
                allowSpaces: false,
                items: ({ query }) => filterBlockItems(query),
                command: ({ editor, range, props: item }) => {
                    executeItem(item, editor, range, options)
                },
                render: () => ({
                    onStart: (props) => {
                        const element = document.createElement("div")
                        element.className = "rich-slash-menu"
                        document.body.appendChild(element)
                        state = {
                            element,
                            items: props.items,
                            selectedIndex: 0,
                            props,
                        }
                        renderMenu(state, options)
                        positionMenu(state)
                    },
                    onUpdate: (props) => {
                        if (!state) return
                        state.props = props
                        state.items = props.items
                        state.selectedIndex = Math.min(
                            state.selectedIndex,
                            Math.max(props.items.length - 1, 0)
                        )
                        renderMenu(state, options)
                        positionMenu(state)
                    },
                    onKeyDown: ({ event }) => {
                        if (!state) return false
                        if (event.key === "ArrowDown") {
                            state.selectedIndex =
                                (state.selectedIndex + 1) % state.items.length
                            renderMenu(state, options)
                            return true
                        }
                        if (event.key === "ArrowUp") {
                            state.selectedIndex =
                                (state.selectedIndex - 1 + state.items.length) %
                                state.items.length
                            renderMenu(state, options)
                            return true
                        }
                        if (event.key === "Enter") {
                            const item = state.items[state.selectedIndex]
                            if (item) {
                                executeItem(
                                    item,
                                    state.props.editor,
                                    state.props.range,
                                    options
                                )
                            }
                            return true
                        }
                        if (event.key === "Escape") {
                            state.element.remove()
                            state = undefined
                            return true
                        }
                        return false
                    },
                    onExit: () => {
                        state?.element.remove()
                        state = undefined
                    },
                }),
            }),
        ]
    },
})
