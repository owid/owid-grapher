import * as Sentry from "@sentry/react"

// Labs is tailnet-only, so its server can tell who's visiting from their
// Tailscale IP. Naming them in Sentry makes feedback (and replays and errors)
// say who it came from.

let labsUser: Promise<string | undefined> | undefined

// The visitor's full name from the admin's users, else their Tailscale login
async function fetchLabsUser(): Promise<string | undefined> {
    try {
        const response = await fetch("/labs/whoami")
        if (!response.ok) return undefined
        const { login, name } = (await response.json()) as {
            login: string | null
            name: string | null
        }
        return name ?? login ?? undefined
    } catch {
        return undefined
    }
}

/**
 * Looks up the visitor once per page and names them in Sentry. Call it again
 * right before using the Sentry user: the site resets the user when cookie
 * preferences change, so this sets it back.
 */
export async function identifyLabsUser(): Promise<string | undefined> {
    labsUser ??= fetchLabsUser()
    const login = await labsUser
    if (login) {
        // The tag survives the site resetting the user, and the #labs alert shows it
        Sentry.setTag("labs_user", login)
        // The feedback form fills in its name field from `username`
        Sentry.setUser({
            ...Sentry.getIsolationScope().getUser(),
            username: login,
        })
    }
    return login
}
