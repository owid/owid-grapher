import React, { useCallback, useMemo } from "react"
import CodeMirror, { EditorView } from "@uiw/react-codemirror"
import { keymap } from "@codemirror/view"
import {
    markdown,
    markdownLanguage,
    markdownKeymap,
} from "@codemirror/lang-markdown"
import {
    history,
    defaultKeymap,
    historyKeymap,
    indentWithTab,
} from "@codemirror/commands"
import { EditorSelection, type StateCommand } from "@codemirror/state"
import {
    syntaxHighlighting,
    defaultHighlightStyle,
} from "@codemirror/language"

import "./MarkdownEditor.scss"

/** Wrap or unwrap the selection with a prefix/suffix delimiter */
function wrapWith(prefix: string, suffix: string): StateCommand {
    return ({ state, dispatch }) => {
        const changes = state.changeByRange((range) => {
            const selected = state.sliceDoc(range.from, range.to)

            // Toggle: if already wrapped, unwrap
            if (
                selected.startsWith(prefix) &&
                selected.endsWith(suffix) &&
                selected.length >= prefix.length + suffix.length
            ) {
                const inner = selected.slice(
                    prefix.length,
                    selected.length - suffix.length
                )
                return {
                    range: EditorSelection.range(
                        range.from,
                        range.from + inner.length
                    ),
                    changes: {
                        from: range.from,
                        to: range.to,
                        insert: inner,
                    },
                }
            }

            // Also check if the surrounding text already has the delimiters
            const before = state.sliceDoc(
                range.from - prefix.length,
                range.from
            )
            const after = state.sliceDoc(range.to, range.to + suffix.length)
            if (before === prefix && after === suffix) {
                return {
                    range: EditorSelection.range(
                        range.from - prefix.length,
                        range.to - prefix.length
                    ),
                    changes: [
                        {
                            from: range.from - prefix.length,
                            to: range.from,
                            insert: "",
                        },
                        {
                            from: range.to,
                            to: range.to + suffix.length,
                            insert: "",
                        },
                    ],
                }
            }

            // Wrap: no selection → insert delimiters with cursor in the middle
            if (range.from === range.to) {
                return {
                    range: EditorSelection.cursor(
                        range.from + prefix.length
                    ),
                    changes: {
                        from: range.from,
                        insert: prefix + suffix,
                    },
                }
            }

            // Wrap: with selection
            return {
                range: EditorSelection.range(
                    range.from + prefix.length,
                    range.to + prefix.length
                ),
                changes: {
                    from: range.from,
                    to: range.to,
                    insert: prefix + selected + suffix,
                },
            }
        })
        dispatch(state.update(changes, { userEvent: "input" }))
        return true
    }
}

/** Insert a markdown link, selecting "url" for easy replacement */
const insertLink: StateCommand = ({ state, dispatch }) => {
    const changes = state.changeByRange((range) => {
        const selected = state.sliceDoc(range.from, range.to)
        const insert = `[${selected}](url)`
        const urlStart = range.from + 1 + selected.length + 2
        return {
            range: EditorSelection.range(urlStart, urlStart + 3),
            changes: { from: range.from, to: range.to, insert },
        }
    })
    dispatch(state.update(changes, { userEvent: "input" }))
    return true
}

// Textarea-like theme: no gutter, no active line highlight
const textareaTheme = EditorView.theme({
    "&": {
        fontSize: "13px",
    },
    "&.cm-focused": {
        outline: "none",
    },
    ".cm-gutters": {
        display: "none",
    },
    ".cm-activeLine": {
        backgroundColor: "transparent",
    },
    ".cm-scroller": {
        fontFamily: "inherit",
    },
})

interface MarkdownEditorProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    height?: string
}

export function MarkdownEditor({
    value,
    onChange,
    placeholder,
    height = "120px",
}: MarkdownEditorProps): React.ReactElement {
    const handleChange = useCallback(
        (val: string) => onChange(val),
        [onChange]
    )

    const extensions = useMemo(
        () => [
            markdown({ base: markdownLanguage }),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            history(),
            EditorView.lineWrapping,
            EditorView.contentAttributes.of({
                "aria-label": placeholder ?? "Markdown text",
            }),
            textareaTheme,
            keymap.of([
                ...markdownKeymap,
                { key: "Mod-b", run: wrapWith("**", "**") },
                { key: "Mod-i", run: wrapWith("*", "*") },
                { key: "Mod-k", run: insertLink },
                indentWithTab,
                ...defaultKeymap,
                ...historyKeymap,
            ]),
        ],
        [placeholder]
    )

    return (
        <div className="MarkdownEditor">
            <CodeMirror
                value={value}
                height={height}
                placeholder={placeholder}
                basicSetup={false}
                extensions={extensions}
                onChange={handleChange}
            />
        </div>
    )
}
