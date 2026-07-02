import { useCallback, useContext, useEffect, useRef, useState } from "react"
import { RouteComponentProps } from "react-router-dom"
import {
    Alert,
    Button,
    Drawer,
    Form,
    Input,
    List,
    Modal,
    Popconfirm,
    Space,
    Tag,
    Typography,
} from "antd"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Editor } from "@tiptap/core"
import { OwidGdocAuthoringMode } from "@ourworldindata/types"
import { dayjs } from "@ourworldindata/utils"
import {
    RichEditorGdocResponse,
    RichEditorRevisionsResponse,
    RichEditorSaveBodyResponse,
} from "../../adminShared/RichEditorTypes.js"
import { AdminAppContext } from "../AdminAppContext.js"
import { AdminLayout } from "../AdminLayout.js"
import { RichEditor } from "./RichEditor.js"
import { richEditorBlockItems } from "./blockRegistry.js"
import { pmDocToEnrichedBlocks } from "./serialization/serialization.js"

type SaveState =
    | { kind: "saved"; at: Date | null }
    | { kind: "dirty" }
    | { kind: "saving" }
    | { kind: "conflict" }
    | { kind: "error"; message: string }

const AUTOSAVE_DEBOUNCE_MS = 2000

export function RichEditorPage(
    props: RouteComponentProps<{ id: string }>
): React.ReactElement {
    const { id } = props.match.params
    if (id === "new") return <CreateNativeGdocPage {...props} />
    return <RichEditorPageForId key={id} id={id} />
}

function CreateNativeGdocPage(
    props: RouteComponentProps<{ id: string }>
): React.ReactElement {
    const { admin } = useContext(AdminAppContext)
    const [creating, setCreating] = useState(false)

    return (
        <AdminLayout title="New data insight">
            <main className="rich-editor-page rich-editor-page--create">
                <Typography.Title level={3}>
                    New native data insight
                </Typography.Title>
                <Form
                    layout="vertical"
                    onFinish={async (values: { title: string }) => {
                        setCreating(true)
                        try {
                            const created = (await admin.requestJSON(
                                "/api/gdocs/createNative",
                                { title: values.title },
                                "POST"
                            )) as unknown as RichEditorGdocResponse
                            props.history.replace(`/gdocs/${created.id}/edit`)
                        } finally {
                            setCreating(false)
                        }
                    }}
                >
                    <Form.Item
                        label="Title"
                        name="title"
                        rules={[{ required: true }]}
                    >
                        <Input placeholder="e.g. Global life expectancy has doubled" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={creating}>
                        Create draft
                    </Button>
                </Form>
            </main>
        </AdminLayout>
    )
}

function RichEditorPageForId(props: { id: string }): React.ReactElement {
    const { id } = props
    const { admin } = useContext(AdminAppContext)
    const queryClient = useQueryClient()

    const gdocQuery = useQuery<RichEditorGdocResponse>({
        queryKey: ["richEditorGdoc", id],
        queryFn: () =>
            admin.getJSON<RichEditorGdocResponse>(`/api/gdocs/${id}/editor`),
        // the editor owns the content after the initial load
        staleTime: Infinity,
        retry: false,
    })

    const editorRef = useRef<Editor | null>(null)
    const requestImageRef = useRef<
        ((insert: (filename: string) => void) => void) | null
    >(null)
    const baseRevisionIdRef = useRef<number | null>(null)
    const [saveState, setSaveState] = useState<SaveState>({
        kind: "saved",
        at: null,
    })
    const saveTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined
    )
    const [revisionsOpen, setRevisionsOpen] = useState(false)

    useEffect(() => {
        if (gdocQuery.data) {
            baseRevisionIdRef.current = gdocQuery.data.draftRevisionId
        }
    }, [gdocQuery.data])

    const doSave = useCallback(
        async (kind: "autosave" | "manual") => {
            const editor = editorRef.current
            if (!editor) return
            setSaveState({ kind: "saving" })
            try {
                const body = pmDocToEnrichedBlocks(editor.getJSON())
                const response = await admin.rawRequest(
                    `/api/gdocs/${id}/body`,
                    JSON.stringify({
                        body,
                        baseRevisionId: baseRevisionIdRef.current,
                        kind,
                    }),
                    "PUT"
                )
                if (response.status === 409) {
                    setSaveState({ kind: "conflict" })
                    return
                }
                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}))
                    setSaveState({
                        kind: "error",
                        message:
                            payload?.error?.message ??
                            `Save failed (${response.status})`,
                    })
                    return
                }
                const saved =
                    (await response.json()) as RichEditorSaveBodyResponse
                baseRevisionIdRef.current = saved.revisionId
                setSaveState({ kind: "saved", at: new Date() })
                await queryClient.invalidateQueries({
                    queryKey: ["richEditorRevisions", id],
                })
            } catch (error) {
                setSaveState({ kind: "error", message: String(error) })
            }
        },
        [admin, id, queryClient]
    )

    const onDirty = useCallback(() => {
        setSaveState((current) =>
            current.kind === "conflict" ? current : { kind: "dirty" }
        )
        if (saveTimeout.current) clearTimeout(saveTimeout.current)
        saveTimeout.current = setTimeout(() => {
            void doSave("autosave")
        }, AUTOSAVE_DEBOUNCE_MS)
    }, [doSave])

    // flush pending changes when leaving the page
    useEffect(() => {
        const beforeUnload = (event: BeforeUnloadEvent): void => {
            if (saveState.kind === "dirty" || saveState.kind === "saving") {
                event.preventDefault()
            }
        }
        window.addEventListener("beforeunload", beforeUnload)
        return () => window.removeEventListener("beforeunload", beforeUnload)
    }, [saveState.kind])

    if (gdocQuery.isLoading) {
        return (
            <AdminLayout title="Rich editor">
                <main className="rich-editor-page">Loading…</main>
            </AdminLayout>
        )
    }
    if (gdocQuery.isError || !gdocQuery.data) {
        return (
            <AdminLayout title="Rich editor">
                <main className="rich-editor-page">
                    <Alert
                        type="error"
                        title={`Could not load document ${id}`}
                        description={String(gdocQuery.error ?? "")}
                    />
                </main>
            </AdminLayout>
        )
    }

    const gdoc = gdocQuery.data
    if (gdoc.authoringMode !== OwidGdocAuthoringMode.Native) {
        return (
            <ConvertToNativePrompt
                gdoc={gdoc}
                onConverted={() =>
                    queryClient.invalidateQueries({
                        queryKey: ["richEditorGdoc", id],
                    })
                }
            />
        )
    }

    const title = gdoc.content.title ?? "Untitled"

    return (
        <AdminLayout title={`Editing: ${title}`} noSidebar fixedNav={false}>
            <main className="rich-editor-page">
                <header className="rich-editor-page__topbar">
                    <div>
                        <Typography.Title level={4} style={{ margin: 0 }}>
                            {title}
                        </Typography.Title>
                        <Space size="small">
                            <Tag color="blue">{gdoc.content.type}</Tag>
                            <Tag color={gdoc.published ? "green" : "default"}>
                                {gdoc.published ? "published" : "draft"}
                            </Tag>
                            <SaveStatus state={saveState} />
                        </Space>
                    </div>
                    <Space>
                        <Button onClick={() => setRevisionsOpen(true)}>
                            History
                        </Button>
                        <Button
                            type="primary"
                            disabled={
                                saveState.kind === "saving" ||
                                saveState.kind === "conflict"
                            }
                            onClick={() => void doSave("manual")}
                        >
                            Save
                        </Button>
                    </Space>
                </header>

                {saveState.kind === "conflict" && (
                    <Alert
                        type="warning"
                        showIcon
                        title="Someone else saved a newer version of this draft."
                        description="Reload to get the newest version. Your unsaved changes will be lost."
                        action={
                            <Button
                                size="small"
                                onClick={() => window.location.reload()}
                            >
                                Reload
                            </Button>
                        }
                    />
                )}
                {saveState.kind === "error" && (
                    <Alert
                        type="error"
                        showIcon
                        title="Saving failed"
                        description={saveState.message}
                        action={
                            <Button
                                size="small"
                                onClick={() => void doSave("manual")}
                            >
                                Retry
                            </Button>
                        }
                    />
                )}

                <div className="rich-editor-page__workspace">
                    <aside className="rich-editor-page__palette">
                        <h4>Insert</h4>
                        {richEditorBlockItems.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                className="rich-editor-page__palette-item"
                                title={item.description}
                                onClick={() => {
                                    const editor = editorRef.current
                                    if (!editor) return
                                    item.command({
                                        editor,
                                        onRequestImage: (insert) =>
                                            requestImageRef.current?.(insert),
                                    })
                                }}
                            >
                                <span className="rich-editor-page__palette-glyph">
                                    {item.glyph}
                                </span>
                                {item.title}
                            </button>
                        ))}
                        <p className="rich-editor-page__palette-hint">
                            Tip: type <code>/</code> in the text to insert
                            blocks without leaving the keyboard.
                        </p>
                    </aside>
                    <RichEditor
                        initialBody={gdoc.content.body ?? []}
                        editorRef={editorRef}
                        requestImageRef={requestImageRef}
                        onDirty={onDirty}
                    />
                </div>

                <RevisionsDrawer
                    id={id}
                    open={revisionsOpen}
                    onClose={() => setRevisionsOpen(false)}
                />
            </main>
        </AdminLayout>
    )
}

function SaveStatus(props: { state: SaveState }): React.ReactElement {
    const { state } = props
    switch (state.kind) {
        case "saved":
            return (
                <Typography.Text type="secondary">
                    {state.at
                        ? `Saved ${dayjs(state.at).format("HH:mm:ss")}`
                        : "Up to date"}
                </Typography.Text>
            )
        case "dirty":
            return (
                <Typography.Text type="secondary">
                    Unsaved changes…
                </Typography.Text>
            )
        case "saving":
            return <Typography.Text type="secondary">Saving…</Typography.Text>
        case "conflict":
            return <Typography.Text type="danger">Conflict</Typography.Text>
        case "error":
            return <Typography.Text type="danger">Save failed</Typography.Text>
    }
}

function ConvertToNativePrompt(props: {
    gdoc: RichEditorGdocResponse
    onConverted: () => void
}): React.ReactElement {
    const { gdoc, onConverted } = props
    const { admin } = useContext(AdminAppContext)
    const [converting, setConverting] = useState(false)

    return (
        <AdminLayout title="Rich editor">
            <main className="rich-editor-page rich-editor-page--create">
                <Typography.Title level={3}>
                    {gdoc.content.title ?? gdoc.id}
                </Typography.Title>
                <Alert
                    type="info"
                    showIcon
                    title="This document is authored in Google Docs"
                    description={
                        <>
                            <p>
                                Converting it to native editing makes the
                                enriched content in the database the source of
                                truth. The Google Doc will no longer be synced —
                                edits made there will be ignored.
                            </p>
                            <Popconfirm
                                title="Convert to native editing?"
                                description="This is one-way. The Google Doc stops being synced."
                                onConfirm={async () => {
                                    setConverting(true)
                                    try {
                                        await admin.requestJSON(
                                            `/api/gdocs/${gdoc.id}/convertToNative`,
                                            {},
                                            "POST"
                                        )
                                        onConverted()
                                    } finally {
                                        setConverting(false)
                                    }
                                }}
                            >
                                <Button type="primary" loading={converting}>
                                    Convert to native editing
                                </Button>
                            </Popconfirm>
                        </>
                    }
                />
            </main>
        </AdminLayout>
    )
}

function RevisionsDrawer(props: {
    id: string
    open: boolean
    onClose: () => void
}): React.ReactElement {
    const { id, open, onClose } = props
    const { admin } = useContext(AdminAppContext)
    const [restoringId, setRestoringId] = useState<number | null>(null)

    const revisionsQuery = useQuery<RichEditorRevisionsResponse>({
        queryKey: ["richEditorRevisions", id],
        queryFn: () =>
            admin.getJSON<RichEditorRevisionsResponse>(
                `/api/gdocs/${id}/revisions`
            ),
        enabled: open,
    })

    return (
        <Drawer
            title="Revision history"
            open={open}
            onClose={onClose}
            size={420}
        >
            <List
                loading={revisionsQuery.isLoading}
                dataSource={revisionsQuery.data?.revisions ?? []}
                renderItem={(revision) => (
                    <List.Item
                        actions={[
                            <Button
                                key="restore"
                                size="small"
                                loading={restoringId === revision.id}
                                onClick={() => {
                                    Modal.confirm({
                                        title: `Restore revision #${revision.id}?`,
                                        content:
                                            "The current draft is kept in the history, so nothing is lost.",
                                        onOk: async () => {
                                            setRestoringId(revision.id)
                                            try {
                                                await admin.requestJSON(
                                                    `/api/gdocs/${id}/revisions/${revision.id}/restore`,
                                                    {},
                                                    "POST"
                                                )
                                                // simplest way to reload editor state cleanly
                                                window.location.reload()
                                            } finally {
                                                setRestoringId(null)
                                            }
                                        },
                                    })
                                }}
                            >
                                Restore
                            </Button>,
                        ]}
                    >
                        <List.Item.Meta
                            title={
                                <Space size="small">
                                    <Tag>{revision.kind}</Tag>
                                    {revision.label ?? `#${revision.id}`}
                                </Space>
                            }
                            description={`${dayjs(revision.createdAt).format(
                                "MMM D, YYYY HH:mm"
                            )}${revision.createdByFullName ? ` · ${revision.createdByFullName}` : ""}`}
                        />
                    </List.Item>
                )}
            />
        </Drawer>
    )
}
