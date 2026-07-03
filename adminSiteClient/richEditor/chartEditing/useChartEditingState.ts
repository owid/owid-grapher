import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { observable, runInAction, type IObservableValue } from "mobx"
import { Modal, message } from "antd"
import type { Editor } from "@tiptap/core"
import type { History } from "history"
import { useQueryClient } from "@tanstack/react-query"
import { AbstractChartEditor } from "../../AbstractChartEditor.js"
import { ChartEditorEnvironment } from "../../ChartEditorEnvironment.js"
import { Admin } from "../../Admin.js"
import {
    EmbeddedChartEditorHost,
    EmbeddedNarrativeChartEditorHost,
} from "./EmbeddedChartEditorHosts.js"
import {
    ChartEditingContextValue,
    ChartEditingSession,
    OpenChartSessionArgs,
    OpenNarrativeChartSessionArgs,
} from "./ChartEditingContext.js"

function confirmDiscard(): Promise<boolean> {
    return new Promise((resolve) => {
        Modal.confirm({
            title: "Discard unsaved chart changes?",
            content:
                "The chart you are editing has unsaved changes that will be lost.",
            okText: "Discard",
            okButtonProps: { danger: true },
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
        })
    })
}

/**
 * State for in-situ chart editing sessions: opening the embedded editor for
 * a block's parent chart or narrative chart, keeping the target block's
 * position mapped through document changes, guarding unsaved changes, and
 * refreshing the canvas' config caches when a session ends.
 *
 * Also owns the (lazily created, page-lifetime) ChartEditorEnvironment that
 * the embedded editor form needs — its dataset/variable database is heavy
 * and fetched at most once per page.
 */
export function useChartEditingState(args: {
    admin: Admin
    tiptapEditor: Editor | null
    history: History
    /** called when a session opens/closes, to switch the rail tab */
    onSessionOpened: () => void
    onSessionClosed: () => void
}): {
    contextValue: ChartEditingContextValue
    environment: ChartEditorEnvironment<AbstractChartEditor> | null
} {
    const { admin, tiptapEditor, history } = args
    const queryClient = useQueryClient()
    const [session, setSession] = useState<ChartEditingSession | null>(null)
    const [isOpeningSession, setIsOpeningSession] = useState(false)

    const sessionRef = useRef(session)
    sessionRef.current = session

    // The active host, held in a MobX box so the environment's reactions can
    // track session changes (a plain ref would leave the second session's
    // editor without its config: the editor→updateGrapher reaction would
    // never re-fire).
    const hostBoxRef = useRef<IObservableValue<
        EmbeddedChartEditorHost | EmbeddedNarrativeChartEditorHost | null
    > | null>(null)
    hostBoxRef.current ??= observable.box(null, { deep: false })
    const hostBox = hostBoxRef.current

    const onSessionOpenedRef = useRef(args.onSessionOpened)
    onSessionOpenedRef.current = args.onSessionOpened
    const onSessionClosedRef = useRef(args.onSessionClosed)
    onSessionClosedRef.current = args.onSessionClosed

    // The environment (editor database, DoD details, validation) is shared by
    // all sessions on this page. Created on first use, disposed on unmount.
    const [environment, setEnvironment] =
        useState<ChartEditorEnvironment<AbstractChartEditor> | null>(null)
    const environmentRef = useRef(environment)
    environmentRef.current = environment

    const ensureEnvironment = useCallback((): void => {
        if (environmentRef.current) return
        const env = new ChartEditorEnvironment<AbstractChartEditor>({
            manager: {
                admin,
                // the environment always follows the active session's editor
                get editor(): AbstractChartEditor {
                    return hostBox.get()?.editor as AbstractChartEditor
                },
            },
        })
        env.start()
        environmentRef.current = env
        setEnvironment(env)
    }, [admin, hostBox])

    useEffect(() => {
        return () => {
            environmentRef.current?.dispose()
            sessionRef.current?.host.editor?.dispose()
        }
    }, [])

    // Keep the target block's position mapped through document changes
    useEffect(() => {
        if (!tiptapEditor) return undefined
        const onTransaction = ({
            transaction,
        }: {
            transaction: { docChanged: boolean; mapping: any }
        }): void => {
            if (!transaction.docChanged) return
            setSession((prev) => {
                if (!prev || prev.blockPos === null) return prev
                const result = transaction.mapping.mapResult(prev.blockPos)
                const blockPos = result.deleted ? null : result.pos
                if (blockPos === prev.blockPos) return prev
                return { ...prev, blockPos }
            })
        }
        tiptapEditor.on("transaction", onTransaction)
        return () => {
            tiptapEditor.off("transaction", onTransaction)
        }
    }, [tiptapEditor])

    const invalidateChartCaches = useCallback(async (): Promise<void> => {
        // refetch saved configs so the canvas shows what was saved
        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: ["richEditorGrapherConfig"],
            }),
            queryClient.invalidateQueries({
                queryKey: ["richEditorGrapherConfigByUuid"],
            }),
            queryClient.invalidateQueries({
                queryKey: ["richEditorNarrativeChart"],
            }),
        ])
    }, [queryClient])

    /** true when it's OK to proceed (no unsaved changes, or user discarded) */
    const guardUnsavedChanges = useCallback(async (): Promise<boolean> => {
        const current = sessionRef.current
        if (!current?.host.editor?.isModified) return true
        return confirmDiscard()
    }, [])

    const replaceSession = useCallback(
        async (next: ChartEditingSession): Promise<void> => {
            sessionRef.current?.host.editor?.dispose()
            runInAction(() => hostBox.set(next.host))
            setSession(next)
            onSessionOpenedRef.current()
        },
        [hostBox]
    )

    const openChartSession = useCallback(
        async (openArgs: OpenChartSessionArgs): Promise<void> => {
            if (!(await guardUnsavedChanges())) return
            setIsOpeningSession(true)
            try {
                ensureEnvironment()
                const host = new EmbeddedChartEditorHost(
                    admin,
                    openArgs.chartId
                )
                await host.init()
                await replaceSession({
                    kind: "chart",
                    blockPos: openArgs.blockPos,
                    identity: openArgs.slug,
                    host,
                })
            } catch (error) {
                console.error(error)
                void message.error("Couldn’t open the chart editor")
            } finally {
                setIsOpeningSession(false)
            }
        },
        [admin, ensureEnvironment, guardUnsavedChanges, replaceSession]
    )

    const openNarrativeChartSession = useCallback(
        async (openArgs: OpenNarrativeChartSessionArgs): Promise<void> => {
            if (!(await guardUnsavedChanges())) return
            setIsOpeningSession(true)
            try {
                ensureEnvironment()
                const host = new EmbeddedNarrativeChartEditorHost(
                    admin,
                    openArgs.narrativeChartId,
                    history
                )
                await host.init()
                await replaceSession({
                    kind: "narrative-chart",
                    blockPos: openArgs.blockPos,
                    identity: openArgs.name,
                    host,
                })
            } catch (error) {
                console.error(error)
                void message.error("Couldn’t open the narrative chart editor")
            } finally {
                setIsOpeningSession(false)
            }
        },
        [admin, ensureEnvironment, guardUnsavedChanges, history, replaceSession]
    )

    const closeSession = useCallback(async (): Promise<void> => {
        if (!sessionRef.current) return
        if (!(await guardUnsavedChanges())) return
        sessionRef.current.host.editor?.dispose()
        runInAction(() => hostBox.set(null))
        setSession(null)
        onSessionClosedRef.current()
        await invalidateChartCaches()
    }, [guardUnsavedChanges, hostBox, invalidateChartCaches])

    // Warn before leaving the page with unsaved chart edits (the article body
    // autosaves, but chart edits only persist via the editor's save button)
    useEffect(() => {
        const onBeforeUnload = (event: BeforeUnloadEvent): void => {
            if (sessionRef.current?.host.editor?.isModified) {
                event.preventDefault()
            }
        }
        window.addEventListener("beforeunload", onBeforeUnload)
        return () => window.removeEventListener("beforeunload", onBeforeUnload)
    }, [])

    const contextValue = useMemo<ChartEditingContextValue>(
        () => ({
            session,
            isOpeningSession,
            openChartSession,
            openNarrativeChartSession,
            closeSession,
        }),
        [
            session,
            isOpeningSession,
            openChartSession,
            openNarrativeChartSession,
            closeSession,
        ]
    )

    return { contextValue, environment }
}
