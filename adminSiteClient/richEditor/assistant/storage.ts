// Persistent browser-side storage for the assistant: provider API keys,
// settings (last model/thinking level, per-doc session pointers), and chat
// sessions. All IndexedDB via pi-web-ui's stores — the same setup as the
// gdocs-chrome-extension this panel is adapted from. Keys never leave the
// browser; LLM calls go straight from the client to the provider.

import {
    AppStorage,
    CustomProvidersStore,
    IndexedDBStorageBackend,
    ProviderKeysStore,
    SessionsStore,
    SettingsStore,
    setAppStorage,
} from "@earendil-works/pi-web-ui"

export const assistantSettings = new SettingsStore()
export const assistantProviderKeys = new ProviderKeysStore()
export const assistantSessions = new SessionsStore()
export const assistantCustomProviders = new CustomProvidersStore()

let initialized = false

/** Idempotent — safe to call every time the panel mounts. */
export function initAssistantStorage(): void {
    if (initialized) return
    initialized = true

    const backend = new IndexedDBStorageBackend({
        dbName: "owid-rich-editor-assistant",
        version: 1,
        stores: [
            assistantSettings.getConfig(),
            SessionsStore.getMetadataConfig(),
            assistantProviderKeys.getConfig(),
            assistantCustomProviders.getConfig(),
            assistantSessions.getConfig(),
        ],
    })
    assistantSettings.setBackend(backend)
    assistantProviderKeys.setBackend(backend)
    assistantCustomProviders.setBackend(backend)
    assistantSessions.setBackend(backend)

    // pi-web-ui dialogs (ModelSelector, ApiKeyPromptDialog, ...) read the
    // globally registered AppStorage
    setAppStorage(
        new AppStorage(
            assistantSettings,
            assistantProviderKeys,
            assistantSessions,
            assistantCustomProviders,
            backend
        )
    )
}
