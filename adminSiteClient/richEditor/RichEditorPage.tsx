import { useCallback, useContext, useEffect, useRef, useState } from "react"
import { RouteComponentProps, useHistory } from "react-router-dom"
import {
    Alert,
    Button,
    Drawer,
    Dropdown,
    Form,
    Input,
    List,
    Modal,
    Popconfirm,
    Select,
    Space,
    Tabs,
    Tag,
    Typography,
} from "antd"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Editor } from "@tiptap/core"
import { OwidGdocAuthoringMode, OwidGdocType } from "@ourworldindata/types"
import { dayjs } from "@ourworldindata/utils"
import {
    RichEditorCommentThreadsResponse,
    RichEditorGdocResponse,
    RichEditorPresenceEditor,
    RichEditorPresenceResponse,
    RichEditorPublishResponse,
    RichEditorPublishValidationResponse,
    RichEditorRevisionsResponse,
    RichEditorSaveBodyResponse,
} from "../../adminShared/RichEditorTypes.js"
import { AdminAppContext } from "../AdminAppContext.js"
import { AdminLayout } from "../AdminLayout.js"
import { RichEditor } from "./RichEditor.js"
import {
    getBlockItemsForDocType,
    RichEditorBlockItem,
} from "./blockRegistry.js"
import { pmDocToEnrichedBlocks } from "./serialization/serialization.js"
import { applyCommentMarks, collectCommentAnchors } from "./comments.js"
import { computeConversionReport } from "./conversionReport.js"
import { CommentsPanel } from "./CommentsPanel.js"
import { SettingsPanel } from "./SettingsPanel.js"
import { BlockInspector } from "./BlockInspector.js"
import { FormatToolbar } from "./FormatToolbar.js"
import {
    InspectedBlock,
    hasTextRangeSelection,
    inspectedBlockFromSelection,
    placeCursorBelowSelectedBlock,
    replaceSelectedBlockWithCursor,
    selectionBlockKey,
} from "./inspection.js"
import { ChartEditingContext } from "./chartEditing/ChartEditingContext.js"
import { useChartEditingState } from "./chartEditing/useChartEditingState.js"
import { EmbeddedChartEditorPanel } from "./chartEditing/EmbeddedChartEditorPanel.js"

type SaveState =
    | { kind: "saved"; at: Date | null }
    | { kind: "dirty" }
    | { kind: "saving" }
    | { kind: "conflict" }
    | { kind: "error"; message: string }

const AUTOSAVE_DEBOUNCE_MS = 2000
const PRESENCE_HEARTBEAT_MS = 20_000

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
        <AdminLayout title="New document">
            <main className="rich-editor-page rich-editor-page--create">
                <Typography.Title level={3}>
                    New native document
                </Typography.Title>
                <Form
                    layout="vertical"
                    initialValues={{ type: OwidGdocType.DataInsight }}
                    onFinish={async (values: {
                        title: string
                        type: string
                    }) => {
                        setCreating(true)
                        try {
                            const created = (await admin.requestJSON(
                                "/api/gdocs/createNative",
                                { title: values.title, type: values.type },
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
                    <Form.Item label="Type" name="type">
                        <Select
                            options={[
                                {
                                    value: OwidGdocType.DataInsight,
                                    label: "Data insight",
                                },
                                {
                                    value: OwidGdocType.Article,
                                    label: "Article (beta)",
                                },
                            ]}
                        />
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

    const isNative =
        gdocQuery.data?.authoringMode === OwidGdocAuthoringMode.Native

    const threadsQuery = useQuery<RichEditorCommentThreadsResponse>({
        queryKey: ["richEditorComments", id],
        queryFn: () =>
            admin.getJSON<RichEditorCommentThreadsResponse>(
                `/api/gdocs/${id}/comments`
            ),
        enabled: isNative,
    })
    const threads = threadsQuery.data?.threads ?? []
    const threadsRef = useRef(threads)
    threadsRef.current = threads

    const editorRef = useRef<Editor | null>(null)
    const [editorInstance, setEditorInstance] = useState<Editor | null>(null)
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
    const [hasTextSelection, setHasTextSelection] = useState(false)
    const [selectionVersion, setSelectionVersion] = useState(0)
    const [inspected, setInspected] = useState<InspectedBlock | null>(null)
    // key of the block the inspector was last built for, so it is only
    // rebuilt when the selection moves to a different block
    const inspectedKeyRef = useRef<string | null>(null)
    const [railTab, setRailTab] = useState("settings")
    const history = useHistory()
    // Rebuild the inspector from the live selection. Needed when a block's
    // node type changed under an unchanged selection (converting a chart
    // block to a narrative chart) — TipTap emits no selectionUpdate then.
    const syncInspector = useCallback(() => {
        const editor = editorRef.current
        if (!editor) return
        const key = selectionBlockKey(editor)
        inspectedKeyRef.current = key
        setInspected(key ? inspectedBlockFromSelection(editor) : null)
    }, [])
    const chartEditing = useChartEditingState({
        admin,
        tiptapEditor: editorInstance,
        history,
        onSessionOpened: () => {
            syncInspector()
            setRailTab("chart")
        },
        onSessionClosed: () =>
            setRailTab((current) =>
                current === "chart"
                    ? inspectedKeyRef.current
                        ? "block"
                        : "settings"
                    : current
            ),
    })
    const chartEditingSession = chartEditing.contextValue.session
    // set while the replace-or-insert-below dialog is open (a palette item
    // was clicked while a component was selected)
    const [pendingInsert, setPendingInsert] =
        useState<RichEditorBlockItem | null>(null)
    const [activeEditors, setActiveEditors] = useState<
        RichEditorPresenceEditor[]
    >([])
    const [publishing, setPublishing] = useState(false)

    // Local overrides for fields the page mutates without refetching
    const [published, setPublished] = useState<boolean | null>(null)
    const [docTitle, setDocTitle] = useState<string | null>(null)
    const [docSlug, setDocSlug] = useState<string | null>(null)

    useEffect(() => {
        if (gdocQuery.data) {
            baseRevisionIdRef.current = gdocQuery.data.draftRevisionId
        }
    }, [gdocQuery.data])

    // Presence heartbeat while the editor is open
    useEffect(() => {
        if (!isNative) return undefined
        let cancelled = false
        const beat = async (): Promise<void> => {
            try {
                const response = await admin.rawRequest(
                    `/api/gdocs/${id}/presence`,
                    JSON.stringify({}),
                    "POST"
                )
                if (!response.ok) return
                const payload =
                    (await response.json()) as RichEditorPresenceResponse
                if (!cancelled) setActiveEditors(payload.editors)
            } catch {
                // presence is advisory; ignore failures
            }
        }
        void beat()
        const interval = setInterval(() => void beat(), PRESENCE_HEARTBEAT_MS)
        return () => {
            cancelled = true
            clearInterval(interval)
        }
    }, [admin, id, isNative])

    // Highlight comment ranges once both the editor and the threads are ready
    const marksAppliedRef = useRef(false)
    useEffect(() => {
        if (
            !marksAppliedRef.current &&
            editorInstance &&
            threadsQuery.data &&
            threadsQuery.data.threads.length > 0
        ) {
            applyCommentMarks(editorInstance, threadsQuery.data.threads)
            marksAppliedRef.current = true
        }
    }, [editorInstance, threadsQuery.data])

    const doSave = useCallback(
        async (kind: "autosave" | "manual") => {
            const editor = editorRef.current
            if (!editor) return
            setSaveState({ kind: "saving" })
            try {
                const body = pmDocToEnrichedBlocks(editor.getJSON())
                const commentAnchors = collectCommentAnchors(
                    editor,
                    threadsRef.current
                )
                const response = await admin.rawRequest(
                    `/api/gdocs/${id}/body`,
                    JSON.stringify({
                        body,
                        baseRevisionId: baseRevisionIdRef.current,
                        kind,
                        commentAnchors,
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
                if (commentAnchors.some((anchor) => anchor.orphaned)) {
                    await queryClient.invalidateQueries({
                        queryKey: ["richEditorComments", id],
                    })
                }
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

    const doPublish = useCallback(async () => {
        // flush pending edits first so the draft head is what gets published
        if (saveTimeout.current) clearTimeout(saveTimeout.current)
        await doSave("manual")
        setPublishing(true)
        try {
            const response = await admin.rawRequest(
                `/api/gdocs/${id}/publish`,
                JSON.stringify({ baseRevisionId: baseRevisionIdRef.current }),
                "POST"
            )
            if (response.status === 409) {
                setSaveState({ kind: "conflict" })
                return
            }
            const payload = await response.json()
            if (!response.ok) {
                const validation =
                    payload as RichEditorPublishValidationResponse
                Modal.error({
                    title: "Publishing failed",
                    content: (
                        <div>
                            <p>{payload?.error?.message ?? "Unknown error"}</p>
                            {validation.validationErrors && (
                                <ul>
                                    {validation.validationErrors.map(
                                        (error, index) => (
                                            <li key={index}>
                                                <strong>
                                                    {error.property}
                                                </strong>
                                                : {error.message}
                                            </li>
                                        )
                                    )}
                                </ul>
                            )}
                        </div>
                    ),
                })
                return
            }
            const publishResult = payload as RichEditorPublishResponse
            baseRevisionIdRef.current = publishResult.revisionId
            setPublished(publishResult.published)
            Modal.success({
                title: "Published",
                content:
                    "The document is queued for deployment and will be live in a few minutes.",
            })
            await queryClient.invalidateQueries({
                queryKey: ["richEditorRevisions", id],
            })
        } catch (error) {
            Modal.error({ title: "Publishing failed", content: String(error) })
        } finally {
            setPublishing(false)
        }
    }, [admin, doSave, id, queryClient])

    const doUnpublish = useCallback(async () => {
        setPublishing(true)
        try {
            await admin.requestJSON(`/api/gdocs/${id}/unpublish`, {}, "POST")
            setPublished(false)
        } finally {
            setPublishing(false)
        }
    }, [admin, id])

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

    const docType = gdoc.content.type as OwidGdocType | undefined
    const isPublished = published ?? gdoc.published
    const title = docTitle ?? gdoc.content.title ?? "Untitled"
    const paletteItems = getBlockItemsForDocType(docType)

    const closeInspector = (): void => {
        setInspected(null)
        inspectedKeyRef.current = null
        setRailTab((current) => (current === "block" ? "settings" : current))
    }

    const runInsertItem = (item: RichEditorBlockItem): void => {
        const editor = editorRef.current
        if (!editor) return
        item.command({
            editor,
            onRequestImage: (insert) => requestImageRef.current?.(insert),
        })
    }

    const confirmPendingInsert = (mode: "replace" | "below"): void => {
        const editor = editorRef.current
        const item = pendingInsert
        setPendingInsert(null)
        if (!editor || !item) return
        const prepared =
            mode === "replace"
                ? replaceSelectedBlockWithCursor(editor)
                : placeCursorBelowSelectedBlock(editor)
        if (prepared) runInsertItem(item)
    }

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
                            <Tag color={isPublished ? "green" : "default"}>
                                {isPublished ? "published" : "draft"}
                            </Tag>
                            <SaveStatus state={saveState} />
                        </Space>
                    </div>
                    <Space>
                        <Button onClick={() => setRevisionsOpen(true)}>
                            History
                        </Button>
                        <Button
                            disabled={
                                saveState.kind === "saving" ||
                                saveState.kind === "conflict"
                            }
                            onClick={() => void doSave("manual")}
                        >
                            Save
                        </Button>
                        {isPublished ? (
                            <Dropdown.Button
                                type="primary"
                                loading={publishing}
                                disabled={saveState.kind === "conflict"}
                                onClick={() => void doPublish()}
                                menu={{
                                    items: [
                                        {
                                            key: "unpublish",
                                            label: "Unpublish",
                                            danger: true,
                                            onClick: () => {
                                                Modal.confirm({
                                                    title: "Unpublish this document?",
                                                    content:
                                                        "It will be removed from the site with the next deploy.",
                                                    okText: "Unpublish",
                                                    okButtonProps: {
                                                        danger: true,
                                                    },
                                                    onOk: () =>
                                                        void doUnpublish(),
                                                })
                                            },
                                        },
                                    ],
                                }}
                            >
                                Publish changes
                            </Dropdown.Button>
                        ) : (
                            <Popconfirm
                                title="Publish this document?"
                                description="It will go live on the site with the next deploy."
                                onConfirm={() => void doPublish()}
                            >
                                <Button
                                    type="primary"
                                    loading={publishing}
                                    disabled={saveState.kind === "conflict"}
                                >
                                    Publish
                                </Button>
                            </Popconfirm>
                        )}
                    </Space>
                </header>

                {activeEditors.length > 0 && (
                    <Alert
                        type="info"
                        showIcon
                        title={`${activeEditors
                            .map((editor) => editor.fullName)
                            .join(", ")} ${
                            activeEditors.length === 1 ? "is" : "are"
                        } also editing this document`}
                        description="There is no real-time merging yet: the last save wins, and you will be warned if someone else saved first."
                    />
                )}

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

                <ChartEditingContext.Provider value={chartEditing.contextValue}>
                    <div className="rich-editor-page__workspace">
                        <aside className="rich-editor-page__palette">
                            <h4>Insert</h4>
                            {paletteItems.map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    className="rich-editor-page__palette-item"
                                    title={item.description}
                                    onClick={() => {
                                        const editor = editorRef.current
                                        if (!editor) return
                                        // with a component selected, ask whether
                                        // to replace it or insert below it
                                        if (selectionBlockKey(editor)) {
                                            setPendingInsert(item)
                                            return
                                        }
                                        runInsertItem(item)
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
                        <div className="rich-editor-page__canvas-col">
                            <FormatToolbar
                                editor={editorInstance}
                                selectionVersion={selectionVersion}
                            />
                            <InlineTitleField
                                key={`title-${id}`}
                                gdocId={id}
                                title={title}
                                getBaseRevisionId={() =>
                                    baseRevisionIdRef.current
                                }
                                onSaved={(revisionId, newTitle) => {
                                    baseRevisionIdRef.current = revisionId
                                    setDocTitle(newTitle)
                                }}
                            />
                            <RichEditor
                                initialBody={gdoc.content.body ?? []}
                                editorRef={editorRef}
                                requestImageRef={requestImageRef}
                                onDirty={onDirty}
                                docType={docType}
                                onCreate={setEditorInstance}
                                onSelectionChange={(editor) => {
                                    setHasTextSelection(
                                        hasTextRangeSelection(editor)
                                    )
                                    setSelectionVersion(
                                        (version) => version + 1
                                    )
                                    // selecting a component (via its hover
                                    // border or body) opens it in the right rail
                                    const key = selectionBlockKey(editor)
                                    if (key === inspectedKeyRef.current) return
                                    inspectedKeyRef.current = key
                                    const block =
                                        inspectedBlockFromSelection(editor)
                                    setInspected(block)
                                    const selectionPos =
                                        editor.state.selection.from
                                    setRailTab((current) => {
                                        // while the embedded chart editor is open,
                                        // interacting with its own block (or
                                        // deselecting) must not switch tabs
                                        if (
                                            current === "chart" &&
                                            (!block ||
                                                chartEditingSession?.blockPos ===
                                                    selectionPos)
                                        )
                                            return current
                                        return block
                                            ? "block"
                                            : current === "block"
                                              ? "settings"
                                              : current
                                    })
                                }}
                            />
                        </div>
                        <aside
                            className={
                                "rich-editor-page__rail" +
                                (railTab === "chart" && chartEditingSession
                                    ? " rich-editor-page__rail--wide"
                                    : "")
                            }
                        >
                            <Tabs
                                size="small"
                                activeKey={railTab}
                                onChange={setRailTab}
                                items={[
                                    ...(inspected
                                        ? [
                                              {
                                                  key: "block",
                                                  label: "Block",
                                                  children: (
                                                      <BlockInspector
                                                          inspected={inspected}
                                                          onClose={
                                                              closeInspector
                                                          }
                                                      />
                                                  ),
                                              },
                                          ]
                                        : []),
                                    ...(chartEditingSession
                                        ? [
                                              {
                                                  key: "chart",
                                                  label: "Chart editor",
                                                  children: (
                                                      <EmbeddedChartEditorPanel
                                                          session={
                                                              chartEditingSession
                                                          }
                                                          environment={
                                                              chartEditing.environment
                                                          }
                                                          onClose={() =>
                                                              void chartEditing.contextValue.closeSession()
                                                          }
                                                      />
                                                  ),
                                              },
                                          ]
                                        : []),
                                    {
                                        key: "settings",
                                        label: "Settings",
                                        children: docType ? (
                                            <SettingsPanel
                                                gdocId={id}
                                                docType={docType}
                                                published={isPublished}
                                                content={gdoc.content}
                                                slug={docSlug ?? gdoc.slug}
                                                getBaseRevisionId={() =>
                                                    baseRevisionIdRef.current
                                                }
                                                onSaved={(
                                                    revisionId,
                                                    values
                                                ) => {
                                                    baseRevisionIdRef.current =
                                                        revisionId
                                                    setDocTitle(values.title)
                                                    setDocSlug(values.slug)
                                                    void queryClient.invalidateQueries(
                                                        {
                                                            queryKey: [
                                                                "richEditorRevisions",
                                                                id,
                                                            ],
                                                        }
                                                    )
                                                }}
                                            />
                                        ) : null,
                                    },
                                    {
                                        key: "comments",
                                        label: threads.some(
                                            (thread) =>
                                                thread.status !== "resolved"
                                        )
                                            ? `Comments (${
                                                  threads.filter(
                                                      (thread) =>
                                                          thread.status !==
                                                          "resolved"
                                                  ).length
                                              })`
                                            : "Comments",
                                        children: (
                                            <CommentsPanel
                                                gdocId={id}
                                                threads={threads}
                                                editor={editorInstance}
                                                hasTextSelection={
                                                    hasTextSelection
                                                }
                                                onThreadsChanged={() =>
                                                    void queryClient.invalidateQueries(
                                                        {
                                                            queryKey: [
                                                                "richEditorComments",
                                                                id,
                                                            ],
                                                        }
                                                    )
                                                }
                                            />
                                        ),
                                    },
                                ]}
                            />
                        </aside>
                    </div>
                </ChartEditingContext.Provider>

                <RevisionsDrawer
                    id={id}
                    open={revisionsOpen}
                    onClose={() => setRevisionsOpen(false)}
                />

                <Modal
                    open={pendingInsert !== null}
                    title={`Insert ${pendingInsert?.title ?? "component"}`}
                    onCancel={() => setPendingInsert(null)}
                    footer={
                        <Space>
                            <Button onClick={() => setPendingInsert(null)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={() => confirmPendingInsert("below")}
                            >
                                Insert below
                            </Button>
                            <Button
                                type="primary"
                                danger
                                onClick={() => confirmPendingInsert("replace")}
                            >
                                Replace selected
                            </Button>
                        </Space>
                    }
                >
                    <p>
                        A <strong>{inspected?.blockType ?? "component"}</strong>{" "}
                        is currently selected. Replace it with the new{" "}
                        <strong>{pendingInsert?.title.toLowerCase()}</strong>,
                        or insert the new component below it?
                    </p>
                </Modal>
            </main>
        </AdminLayout>
    )
}

/**
 * The document title as an editable field at the top of the canvas. Saves on
 * blur through the settings endpoint (same draft/revision mechanics as
 * everything else).
 */
function InlineTitleField(props: {
    gdocId: string
    title: string
    getBaseRevisionId: () => number | null
    onSaved: (revisionId: number, title: string) => void
}): React.ReactElement {
    const { admin } = useContext(AdminAppContext)
    const [value, setValue] = useState(props.title)

    const save = async (): Promise<void> => {
        const trimmed = value.trim()
        if (!trimmed || trimmed === props.title) return
        const response = await admin.rawRequest(
            `/api/gdocs/${props.gdocId}/editorSettings`,
            JSON.stringify({
                settings: { title: trimmed },
                baseRevisionId: props.getBaseRevisionId(),
            }),
            "PUT"
        )
        if (response.ok) {
            const saved = (await response.json()) as RichEditorSaveBodyResponse
            props.onSaved(saved.revisionId, trimmed)
        }
    }

    return (
        <Input.TextArea
            className="rich-editor-page__inline-title"
            autoSize
            variant="borderless"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onBlur={() => void save()}
            onPressEnter={(event) => {
                event.preventDefault()
                event.currentTarget.blur()
            }}
        />
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

    const report = computeConversionReport(gdoc.content.body ?? [])
    const rawEntries = Object.entries(report.rawBlockCounts)
    const canConvert = report.roundTripOk && !report.conversionError

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
                        <p>
                            Converting it to native editing makes the enriched
                            content in the database the source of truth. The
                            Google Doc will no longer be synced — edits made
                            there will be ignored.
                        </p>
                    }
                />
                <Alert
                    style={{ marginTop: 12 }}
                    type={
                        !canConvert
                            ? "error"
                            : rawEntries.length > 0
                              ? "warning"
                              : "success"
                    }
                    showIcon
                    title="Conversion report"
                    description={
                        <>
                            <p>
                                {report.editableBlocks} of {report.totalBlocks}{" "}
                                top-level blocks are fully editable in the rich
                                editor.
                            </p>
                            {rawEntries.length > 0 && (
                                <p>
                                    These blocks are not natively supported yet
                                    and will be preserved as read-only raw
                                    blocks (they can still be moved and
                                    deleted):{" "}
                                    {rawEntries
                                        .map(
                                            ([type, count]) =>
                                                `${type} (${count})`
                                        )
                                        .join(", ")}
                                </p>
                            )}
                            {report.conversionError ? (
                                <p>
                                    Conversion failed: {report.conversionError}
                                </p>
                            ) : (
                                <p>
                                    Lossless round-trip check:{" "}
                                    {report.roundTripOk
                                        ? "passed ✓"
                                        : "FAILED — do not convert this document; please report it."}
                                </p>
                            )}
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
                                <Button
                                    type="primary"
                                    loading={converting}
                                    disabled={!canConvert}
                                >
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
