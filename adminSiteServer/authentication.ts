import * as Sentry from "@sentry/node"
import { Context, MiddlewareHandler } from "hono"
import { getCookie, deleteCookie } from "hono/cookie"
import * as db from "../db/db.js"
import { CLOUDFLARE_AUD } from "../settings/serverSettings.js"
import * as jose from "jose"
import {
    AdminApiKeysTableName,
    UsersTableName,
    type DbAdminApiKey,
} from "@ourworldindata/types"
import { DbPlainUser } from "@ourworldindata/utils"
import { execWrapper } from "../db/execWrapper.js"
import { hashApiKey } from "../serverUtils/apiKey.js"

/**
 * Hono Variables type — use `c.get("user")` / `c.set("user", ...)` in handlers.
 */
export type AppVariables = {
    user: DbPlainUser
}

/** Convenience alias so handler files can keep `Request`-style naming. */
export type HonoContext = Context<{ Variables: AppVariables }>

/**
 * Re-export compat types so handler files that import { Request } from
 * "../authentication.js" or { Response } from "../authentication.js" keep working.
 */
export type {
    CompatRequest as Request,
    CompatResponse as Response,
} from "./FunctionalRouter.js"

const API_KEY_HEADER = "authorization"
const ACT_AS_USER_HEADER = "x-act-as-user"
const CLOUDFLARE_COOKIE_NAME = "CF_Authorization"
const CLOUDFLARE_TEAM_DOMAIN = "https://owid.cloudflareaccess.com"
const DEV_ADMIN_EMAIL = "admin@example.com"

// Hoist to module scope so it's created once and reused across requests.
const jwks = jose.createRemoteJWKSet(
    new URL(`${CLOUDFLARE_TEAM_DOMAIN}/cdn-cgi/access/certs`)
)

async function setAuthenticatedUser(
    c: HonoContext,
    user: DbPlainUser,
    trx: db.KnexReadWriteTransaction
): Promise<void> {
    c.set("user", user)
    Sentry.setUser({
        email: user.email,
        username: user.fullName,
    })
    await updateUserLastSeen(trx, user.id)
}

export const cloudflareAuthMiddleware: MiddlewareHandler<{
    Variables: AppVariables
}> = async (c, next) => {
    const jwt = getCookie(c, CLOUDFLARE_COOKIE_NAME)
    if (!jwt) return next()

    if (!CLOUDFLARE_AUD) {
        console.error(
            "Missing or empty audience tag. Please add CLOUDFLARE_AUD key in settings."
        )
        return next()
    }

    // Validate the JWT token using the public key from Cloudflare Access
    // see https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/#javascript-example
    let verified: jose.JWTVerifyResult<jose.JWTPayload>
    try {
        verified = await jose.jwtVerify(jwt, jwks, {
            audience: CLOUDFLARE_AUD,
            issuer: CLOUDFLARE_TEAM_DOMAIN,
        })
    } catch (err) {
        // Authorization token invalid: verification failed, token expired or wrong audience.
        console.error(err)
        return next()
    }

    const payload = verified.payload

    if (!payload.email) {
        console.error("Missing email in JWT claims.")
        return next()
    }

    // Here in the middleware we don't have access to the transaction yet so we get a knexinstance manually
    const user = await db
        .knexInstance()
        .table(UsersTableName)
        .where({ email: payload.email })
        .first<DbPlainUser>()

    if (!user) {
        console.error(
            `User with email ${payload.email} not found. Please contact an administrator.`
        )
        return next()
    }

    await db.knexReadWriteTransaction(async (trx) => {
        await setAuthenticatedUser(c, user, trx)
    })
    return next()
}

export const apiKeyAuthMiddleware: MiddlewareHandler<{
    Variables: AppVariables
}> = async (c, next) => {
    if (c.get("user")) return next()

    const apiKey = getApiKeyFromRequest(c)
    if (!apiKey) return next()

    await db.knexReadWriteTransaction(async (trx) => {
        const apiKeyRow = await findAdminApiKey(apiKey, trx)
        if (!apiKeyRow) {
            console.error("Invalid admin API key.")
            return
        }

        const user = await trx<DbPlainUser>(UsersTableName)
            .where({ id: apiKeyRow.userId })
            .first()

        if (!user) {
            console.error(
                `User with id ${apiKeyRow.userId} not found. Please contact an administrator.`
            )
            return
        }

        let authenticatedUser = user
        const actAsUserId = getActAsUserIdFromRequest(c)
        if (!user.isSuperuser && actAsUserId !== undefined) {
            console.error("Non-superuser attempted to use x-act-as-user.", {
                userId: user.id,
                actAsUserId,
            })
            return
        }

        if (user.isSuperuser && actAsUserId !== undefined) {
            if (!user.isActive) {
                console.error(
                    "Inactive superuser attempted to use x-act-as-user.",
                    {
                        userId: user.id,
                        actAsUserId,
                    }
                )
                return
            }

            const actAsUser = await trx<DbPlainUser>(UsersTableName)
                .where({ id: actAsUserId })
                .first()
            if (!actAsUser) {
                console.error(
                    `User with id ${actAsUserId} not found. Please contact an administrator.`
                )
                return
            }
            logActAsUser(c, user.id, actAsUserId)
            authenticatedUser = actAsUser
        }

        await setAuthenticatedUser(c, authenticatedUser, trx)
        await updateApiKeyLastUsed(apiKeyRow.id, trx)
    })
    return next()
}

export const tailscaleAuthMiddleware: MiddlewareHandler<{
    Variables: AppVariables
}> = async (c, next) => {
    if (c.get("user")) return next()

    const clientIp = getClientIp(c)

    if (!clientIp) {
        console.error("Could not determine client IP address.")
        return next()
    }

    const ipToUserMap = await getTailscaleIpToUserMap()

    const githubUserName = ipToUserMap[clientIp]

    if (!githubUserName) {
        return next()
    }

    let user
    try {
        user = await db
            .knexInstance()
            .table(UsersTableName)
            .where({ githubUsername: githubUserName })
            .first<DbPlainUser>()
    } catch (error) {
        console.error(`Error looking up user by githubUsername: ${error}`)
        return next()
    }

    if (!user) {
        console.error(
            `User with githubUsername ${githubUserName} not found in MySQL.`
        )
        return next()
    }

    await db.knexReadWriteTransaction(async (trx) => {
        await setAuthenticatedUser(c, user, trx)
    })

    return next()
}

export const devAuthMiddleware: MiddlewareHandler<{
    Variables: AppVariables
}> = async (c, next) => {
    if (c.get("user")) return next()

    const user = await getDevAdminUser()
    if (!user) {
        console.error(
            `Dev admin user ${DEV_ADMIN_EMAIL} not found. Run \`make refresh\` to seed it or create it manually.`
        )
        return next()
    }

    await db.knexReadWriteTransaction(async (trx) => {
        await setAuthenticatedUser(c, user, trx)
    })
    return next()
}

export const requireAdminAuthMiddleware: MiddlewareHandler<{
    Variables: AppVariables
}> = async (c, next) => {
    // Authed urls shouldn't be cached
    c.header("Cache-Control", "private, no-cache")

    const user = c.get("user")
    if (user?.isActive) {
        return next()
    }

    const status = user ? 403 : 401
    const message =
        status === 403
            ? "User is inactive. Please contact an administrator."
            : "Unauthorized"

    return c.text(message, status)
}

export async function logOut(c: HonoContext) {
    deleteCookie(c, CLOUDFLARE_COOKIE_NAME)
    return c.redirect("/admin")
}

async function getDevAdminUser(): Promise<DbPlainUser | undefined> {
    return db.knexReadWriteTransaction(async (trx) => {
        return await trx<DbPlainUser>(UsersTableName)
            .where({ email: DEV_ADMIN_EMAIL })
            .first()
    })
}

function getClientIp(c: HonoContext): string | undefined {
    let ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip")
    if (ip && ip.startsWith("::ffff:")) {
        ip = ip.replace("::ffff:", "")
    }
    return ip
}

function getApiKeyFromRequest(c: HonoContext): string | undefined {
    const authorizationHeader = c.req.header(API_KEY_HEADER)
    if (!authorizationHeader) return undefined
    const trimmed = authorizationHeader.trim()
    if (!trimmed) return undefined
    const bearerPrefix = "Bearer "
    if (!trimmed.startsWith(bearerPrefix)) return undefined
    const token = trimmed.slice(bearerPrefix.length).trim()
    return token.length ? token : undefined
}

function getActAsUserIdFromRequest(c: HonoContext): number | undefined {
    const header = c.req.header(ACT_AS_USER_HEADER)
    if (!header) return undefined
    const trimmed = header.trim()
    if (!trimmed) return undefined
    const parsed = Number.parseInt(trimmed, 10)
    if (Number.isNaN(parsed) || parsed <= 0) return undefined
    return parsed
}

function logActAsUser(
    c: HonoContext,
    superuserId: number,
    actAsUserId: number
): void {
    console.info("Admin API key act-as", {
        superuserId,
        actAsUserId,
        method: c.req.method,
        path: c.req.url,
    })
}

async function findAdminApiKey(
    apiKey: string,
    trx: db.KnexReadWriteTransaction
) {
    const keyHash = hashApiKey(apiKey)
    return await trx<DbAdminApiKey>(AdminApiKeysTableName)
        .where({ keyHash })
        .first("id", "userId")
}

async function updateApiKeyLastUsed(
    apiKeyId: number,
    trx: db.KnexReadWriteTransaction
) {
    await trx<DbAdminApiKey>(AdminApiKeysTableName)
        .where({ id: apiKeyId })
        .update({ lastUsedAt: new Date() })
}

async function updateUserLastSeen(
    trx: db.KnexReadWriteTransaction,
    userId: number
) {
    await trx<DbPlainUser>(UsersTableName).where({ id: userId }).update({
        lastSeen: new Date(),
    })
}

interface TailscaleStatus {
    Self?: {
        UserID: string
        TailscaleIPs: string[]
    }
    Peer?: {
        [key: string]: {
            UserID: string
            TailscaleIPs: string[]
            HostName: string
            Online: boolean
        }
    }
    User?: {
        [key: string]: {
            DisplayName?: string
            LoginName?: string
        }
    }
}

async function getTailscaleIpToUserMap(): Promise<Record<string, string>> {
    return execWrapper("tailscale status --json")
        .then((res) => {
            const tailscaleStatus: TailscaleStatus = JSON.parse(res.stdout)
            const ipToUser: Record<string, string> = {}

            // Map UserIDs to LoginNames
            const userIdToLoginName: Record<string, string> = {}

            if (tailscaleStatus.User) {
                for (const [userId, userInfo] of Object.entries(
                    tailscaleStatus.User
                )) {
                    if (userInfo.LoginName) {
                        userIdToLoginName[parseInt(userId)] = userInfo.LoginName
                    }
                }
            }

            // Include Peers
            if (tailscaleStatus.Peer) {
                for (const peer of Object.values(tailscaleStatus.Peer)) {
                    if (peer.UserID in userIdToLoginName) {
                        const LoginName = userIdToLoginName[peer.UserID]
                        for (const ip of peer.TailscaleIPs) {
                            ipToUser[ip] = LoginName
                        }
                    }
                }
            }

            return ipToUser
        })
        .catch((error) => {
            console.error(`Error getting Tailscale status: ${error}`)
            throw error
        })
}
