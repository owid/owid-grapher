import { useContext, useState } from "react"
import { Button, Input, Popover, Select, Space, Tooltip } from "antd"
import { useQuery } from "@tanstack/react-query"
import { Editor } from "@tiptap/core"
import { DbPlainDod } from "@ourworldindata/types"
import { AdminAppContext } from "../AdminAppContext.js"
import { pmMarkNames } from "../../adminShared/richEditor/serialization/pmJson.js"

// Inline-formatting toolbar above the canvas: bold/italic/underline plus the
// OWID-specific marks — links, details-on-demand, and footnote refs.

function MarkButton(props: {
    editor: Editor
    label: string
    tooltip: string
    active: boolean
    onClick: () => void
}): React.ReactElement {
    return (
        <Tooltip title={props.tooltip}>
            <Button
                size="small"
                type={props.active ? "primary" : "text"}
                onMouseDown={(event) => {
                    // don't steal the editor selection
                    event.preventDefault()
                    props.onClick()
                }}
            >
                {props.label}
            </Button>
        </Tooltip>
    )
}

function useDodOptions(): { value: string; label: string }[] {
    const { admin } = useContext(AdminAppContext)
    const dodsQuery = useQuery({
        queryKey: ["richEditorDods"],
        queryFn: () => admin.getJSON<{ dods: DbPlainDod[] }>("/api/dods.json"),
        staleTime: Infinity,
    })
    return (dodsQuery.data?.dods ?? []).map((dod) => ({
        value: dod.name,
        label: dod.name,
    }))
}

export function FormatToolbar(props: {
    editor: Editor | null
    /** bumped on selection changes so active states rerender */
    selectionVersion: number
}): React.ReactElement | null {
    const { editor } = props
    const [linkUrl, setLinkUrl] = useState("")
    const [linkOpen, setLinkOpen] = useState(false)
    const [refUrl, setRefUrl] = useState("")
    const [refOpen, setRefOpen] = useState(false)
    const [dodOpen, setDodOpen] = useState(false)
    const dodOptions = useDodOptions()

    if (!editor) return null
    const hasSelection = !editor.state.selection.empty

    return (
        <div className="rich-editor-toolbar" role="toolbar">
            <Space size={2}>
                <MarkButton
                    editor={editor}
                    label="B"
                    tooltip="Bold (Cmd+B)"
                    active={editor.isActive(pmMarkNames.bold)}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                />
                <MarkButton
                    editor={editor}
                    label="I"
                    tooltip="Italic (Cmd+I)"
                    active={editor.isActive(pmMarkNames.italic)}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                />
                <MarkButton
                    editor={editor}
                    label="U"
                    tooltip="Underline (Cmd+U)"
                    active={editor.isActive(pmMarkNames.underline)}
                    onClick={() =>
                        editor.chain().focus().toggleUnderline().run()
                    }
                />
                <Popover
                    open={linkOpen}
                    onOpenChange={(open) => {
                        setLinkOpen(open)
                        if (open) {
                            setLinkUrl(
                                String(
                                    editor.getAttributes(pmMarkNames.link)
                                        .url ?? ""
                                )
                            )
                        }
                    }}
                    trigger="click"
                    content={
                        <Space.Compact style={{ width: 320 }}>
                            <Input
                                size="small"
                                placeholder="https://…"
                                value={linkUrl}
                                onChange={(event) =>
                                    setLinkUrl(event.target.value)
                                }
                                onPressEnter={() => {
                                    if (linkUrl) {
                                        editor
                                            .chain()
                                            .focus()
                                            .setMark(pmMarkNames.link, {
                                                url: linkUrl,
                                            })
                                            .run()
                                    }
                                    setLinkOpen(false)
                                }}
                            />
                            <Button
                                size="small"
                                onClick={() => {
                                    editor
                                        .chain()
                                        .focus()
                                        .unsetMark(pmMarkNames.link)
                                        .run()
                                    setLinkOpen(false)
                                }}
                            >
                                Remove
                            </Button>
                        </Space.Compact>
                    }
                >
                    <Button
                        size="small"
                        type={
                            editor.isActive(pmMarkNames.link)
                                ? "primary"
                                : "text"
                        }
                        disabled={
                            !hasSelection && !editor.isActive(pmMarkNames.link)
                        }
                    >
                        Link
                    </Button>
                </Popover>
                <Popover
                    open={dodOpen}
                    onOpenChange={setDodOpen}
                    trigger="click"
                    content={
                        <Select
                            size="small"
                            style={{ width: 320 }}
                            showSearch
                            placeholder="Details-on-demand term"
                            options={dodOptions}
                            value={
                                (editor.getAttributes(pmMarkNames.dod).id as
                                    | string
                                    | undefined) || undefined
                            }
                            onChange={(id) => {
                                editor
                                    .chain()
                                    .focus()
                                    .setMark(pmMarkNames.dod, { id })
                                    .run()
                                setDodOpen(false)
                            }}
                        />
                    }
                >
                    <Button
                        size="small"
                        type={
                            editor.isActive(pmMarkNames.dod)
                                ? "primary"
                                : "text"
                        }
                        disabled={
                            !hasSelection && !editor.isActive(pmMarkNames.dod)
                        }
                    >
                        DoD
                    </Button>
                </Popover>
                <Popover
                    open={refOpen}
                    onOpenChange={(open) => {
                        setRefOpen(open)
                        if (open) {
                            setRefUrl(
                                String(
                                    editor.getAttributes(pmMarkNames.ref).url ??
                                        ""
                                )
                            )
                        }
                    }}
                    trigger="click"
                    content={
                        <Space.Compact style={{ width: 320 }}>
                            <Input
                                size="small"
                                placeholder="Source URL for the footnote"
                                value={refUrl}
                                onChange={(event) =>
                                    setRefUrl(event.target.value)
                                }
                                onPressEnter={() => {
                                    if (refUrl) {
                                        editor
                                            .chain()
                                            .focus()
                                            .setMark(pmMarkNames.ref, {
                                                url: refUrl,
                                            })
                                            .run()
                                    }
                                    setRefOpen(false)
                                }}
                            />
                            <Button
                                size="small"
                                onClick={() => {
                                    editor
                                        .chain()
                                        .focus()
                                        .unsetMark(pmMarkNames.ref)
                                        .run()
                                    setRefOpen(false)
                                }}
                            >
                                Remove
                            </Button>
                        </Space.Compact>
                    }
                >
                    <Button
                        size="small"
                        type={
                            editor.isActive(pmMarkNames.ref)
                                ? "primary"
                                : "text"
                        }
                        disabled={
                            !hasSelection && !editor.isActive(pmMarkNames.ref)
                        }
                    >
                        Ref
                    </Button>
                </Popover>
                <MarkButton
                    editor={editor}
                    label="Clear"
                    tooltip="Remove formatting from the selection"
                    active={false}
                    onClick={() => editor.chain().focus().unsetAllMarks().run()}
                />
            </Space>
        </div>
    )
}
