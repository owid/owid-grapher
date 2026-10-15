import { useId, useRef, useState, useSyncExternalStore } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowRight,
    faSliders,
    faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons"
import { AiModePanel } from "./AiModePanel.js"
import type { PanelStore, PanelTab } from "./configureWithAiStore.js"
import "./ConfigureWithAi.scss"

const SEEN_STORAGE_KEY = "configure-with-ai:seen"

function readSeen(): boolean {
    try {
        return localStorage.getItem(SEEN_STORAGE_KEY) === "1"
    } catch {
        return false
    }
}

function rememberSeen(): void {
    try {
        localStorage.setItem(SEEN_STORAGE_KEY, "1")
    } catch {
        // The badge just shows again next time
    }
}

const TABS: { id: PanelTab; label: string }[] = [
    { id: "customize", label: "Customize" },
    { id: "ai", label: "AI mode" },
]

/** Grapher's side panel with two tabs: the entity selector and AI mode */
export function SidePanelTabs({
    store,
    entitySelector,
}: {
    store: PanelStore
    entitySelector: React.ReactElement | null
}) {
    const state = useSyncExternalStore(store.subscribe, store.getState)
    const [hasSeenAi, setHasSeenAi] = useState(readSeen)
    const tabRefs = useRef<Record<PanelTab, HTMLButtonElement | null>>({
        customize: null,
        ai: null,
    })
    const id = useId()

    const selectTab = (tab: PanelTab, focus = false): void => {
        store.setTab(tab)
        if (tab === "ai" && !hasSeenAi) {
            setHasSeenAi(true)
            rememberSeen()
        }
        if (focus) tabRefs.current[tab]?.focus()
    }

    const onTabKeyDown = (event: React.KeyboardEvent): void => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
        event.preventDefault()
        selectTab(state.tab === "customize" ? "ai" : "customize", true)
    }

    return (
        <div className="configure-with-ai">
            <div
                className="configure-with-ai__tabs"
                role="tablist"
                aria-label="How to change the chart"
            >
                {TABS.map((tab) => {
                    const isSelected = state.tab === tab.id
                    return (
                        <button
                            key={tab.id}
                            ref={(el) => {
                                tabRefs.current[tab.id] = el
                            }}
                            id={`${id}-tab-${tab.id}`}
                            className="configure-with-ai__tab"
                            type="button"
                            role="tab"
                            aria-selected={isSelected}
                            aria-controls={`${id}-panel-${tab.id}`}
                            tabIndex={isSelected ? 0 : -1}
                            onClick={() => selectTab(tab.id)}
                            onKeyDown={onTabKeyDown}
                        >
                            <FontAwesomeIcon
                                icon={
                                    tab.id === "ai"
                                        ? faWandMagicSparkles
                                        : faSliders
                                }
                            />
                            {tab.label}
                            {tab.id === "ai" && !hasSeenAi && (
                                <span
                                    className="configure-with-ai__badge"
                                    aria-hidden="true"
                                >
                                    New
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>
            <div
                className="configure-with-ai__tab-panel"
                id={`${id}-panel-${state.tab}`}
                role="tabpanel"
                aria-labelledby={`${id}-tab-${state.tab}`}
            >
                {state.tab === "customize" ? (
                    <>
                        <div className="configure-with-ai__customize">
                            {entitySelector ?? (
                                <p className="configure-with-ai__muted">
                                    Countries can't be changed on this tab.
                                </p>
                            )}
                        </div>
                        {!hasSeenAi && (
                            <button
                                className="configure-with-ai__try-ai"
                                type="button"
                                onClick={() => selectTab("ai")}
                            >
                                <FontAwesomeIcon icon={faWandMagicSparkles} />
                                <span>
                                    <strong>Try AI mode:</strong> describe the
                                    view you want
                                </span>
                                <FontAwesomeIcon icon={faArrowRight} />
                            </button>
                        )}
                    </>
                ) : (
                    <AiModePanel store={store} state={state} />
                )}
            </div>
        </div>
    )
}
