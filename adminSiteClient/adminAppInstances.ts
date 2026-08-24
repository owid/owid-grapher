import {
    App,
    message as staticMessage,
    Modal as staticModal,
    notification as staticNotification,
} from "antd"

/**
 * antd's static `notification.*` / `message.*` / `Modal.confirm` entry points
 * render outside the React tree, so they don't see our `<ConfigProvider>` and
 * come out unthemed. The instances `App.useApp()` hands out do — but most of
 * our call sites are MobX class components, which can't use hooks.
 *
 * This module bridges the two: a small component rendered inside antd's `<App>`
 * (see `AdminAppInstancesBridge` in `AdminApp.tsx`) passes the instances to
 * `setAdminAppInstances`, and the `notification` / `message` / `modal` exports
 * below forward to them. Call sites keep the ergonomics they had — they just
 * import from here rather than from `antd`.
 */

type AppInstances = ReturnType<typeof App.useApp>

export type NotificationInstance = AppInstances["notification"]
export type MessageInstance = AppInstances["message"]
export type ModalInstance = AppInstances["modal"]

let instances: AppInstances | undefined

export function setAdminAppInstances(next: AppInstances): void {
    instances = next
}

/**
 * A stand-in for one of the `App.useApp()` instances that resolves on every
 * property access, falling back to antd's static API while the bridge hasn't
 * rendered yet (module-level calls, tests) — i.e. to the unthemed-but-working
 * behaviour we had before.
 */
function bridge<K extends keyof AppInstances>(
    key: K,
    fallback: object
): AppInstances[K] {
    const handler: ProxyHandler<object> = {
        get(_target, property) {
            const api = instances?.[key] ?? fallback
            const value = Reflect.get(api, property)
            return typeof value === "function" ? value.bind(api) : value
        },
    }
    return new Proxy({}, handler) as AppInstances[K]
}

export const notification = bridge("notification", staticNotification)
export const message = bridge("message", staticMessage)
export const modal = bridge("modal", staticModal)
