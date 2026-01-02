import * as Sentry from "@sentry/node"
import express from "express"
import * as db from "../db/db.js"
import { CLOUDFLARE_AUD } from "../settings/serverSettings.js"
import * as jose from "jose"
import { DbPlainUser, JsonError } from "@ourworldindata/utils"
import { execWrapper } from "../db/execWrapper.js"

export type Request = express.Request

export type Response = express.Response<any, { user: DbPlainUser }>

const CLOUDFLARE_COOKIE_NAME = "CF_Authorization"
const CLOUDFLARE_TEAM_DOMAIN = "https://owid.cloudflareaccess.com"
const DEV_ADMIN_EMAIL = "admin@example.com"
const DEV_ADMIN_FULL_NAME = "Admin User"

// Hoist to module scope so it's created once and reused across requests.
const jwks = jose.createRemoteJWKSet(
    new URL(`${CLOUDFLARE_TEAM_DOMAIN}/cdn-cgi/access/certs`)
)

interface SessionRow {
    session_key: string
    session_data: string
    expire_date: Date
}

async function setAuthenticatedUser(
    res: express.Response,
    user: DbPlainUser
): Promise<void> {
    res.locals.user = user
    Sentry.setUser({
        email: user.email,
        username: user.fullName,
    })
    await db.knexReadWriteTransaction(async (trx) => {
        await trx
            .table("users")
            .where({ id: user.id })
            .update({ lastSeen: new Date() })
    })
}

export async function cloudflareAuthMiddleware(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) {
    const jwt = req.cookies[CLOUDFLARE_COOKIE_NAME]
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
        .table("users")
        .where({ email: payload.email })
        .first<DbPlainUser>()

    if (!user) {
        console.error(
            `User with email ${payload.email} not found. Please contact an administrator.`
        )
        return next()
    }

    await setAuthenticatedUser(res, user)
    return next()
}

export async function tailscaleAuthMiddleware(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) {
    if (res.locals.user) return next()

    const clientIp = getClientIp(req)

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
            .table("users")
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

    await setAuthenticatedUser(res, user)

    return next()
}

export async function devAuthMiddleware(
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction
) {
    if (res.locals.user) return next()

    const user = await getOrCreateDevAdminUser()
    await setAuthenticatedUser(res, user)
    return next()
}

export async function sessionCookieAuthMiddleware(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) {
    if (res.locals.user) return next()

    const sessionid = req.cookies["sessionid"]
    if (!sessionid) return next()

    const user = await db.knexReadWriteTransaction(async (trx) => {
        const rows = await db.knexRaw<SessionRow>(
            trx,
            `SELECT * FROM sessions WHERE session_key = ? AND expire_date >= NOW()`,
            [sessionid]
        )
        if (!rows.length) return null

        const sessionData = Buffer.from(
            rows[0].session_data,
            "base64"
        ).toString("utf8")
        const sessionJson = JSON.parse(
            sessionData.split(":").slice(1).join(":")
        )

        const user = await trx
            .table("users")
            .where({ email: sessionJson.user_email })
            .first<DbPlainUser>()
        if (!user) throw new JsonError("Invalid session (no such user)", 500)

        return user
    })

    if (!user) return next()

    await setAuthenticatedUser(res, user)

    return next()
}

export function requireAdminAuthMiddleware(
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction
) {
    // Authed urls shouldn't be cached
    res.set("Cache-Control", "private, no-cache")

    if (res.locals.user?.isActive) {
        return next()
    }

    const status = res.locals.user ? 403 : 401
    const message =
        status === 403
            ? "User is inactive. Please contact an administrator."
            : "Unauthorized"

    return res.status(status).send(message)
}

export async function logOut(req: express.Request, res: express.Response) {
    const sessionid = req.cookies["sessionid"]
    if (sessionid) {
        await db.knexReadWriteTransaction((trx) =>
            db.knexRaw(trx, `DELETE FROM sessions WHERE session_key = ?`, [
                sessionid,
            ])
        )
    }

    res.clearCookie("sessionid")
    res.clearCookie(CLOUDFLARE_COOKIE_NAME)
    return res.redirect("/admin")
}

async function getOrCreateDevAdminUser(): Promise<DbPlainUser> {
    return db.knexReadWriteTransaction(async (trx) => {
        const existing = await trx
            .table("users")
            .where({ email: DEV_ADMIN_EMAIL })
            .first<DbPlainUser>()
        if (existing) return existing

        const now = new Date()
        const [id] = await trx.table("users").insert({
            email: DEV_ADMIN_EMAIL,
            fullName: DEV_ADMIN_FULL_NAME,
            isActive: 1,
            isSuperuser: 1,
            createdAt: now,
            updatedAt: now,
        })

        const created = await trx
            .table("users")
            .where({ id: id as number })
            .first<DbPlainUser>()

        if (!created) {
            throw new Error("Failed to create dev admin user")
        }

        return created
    })
}

function getClientIp(req: express.Request): string | undefined {
    let ip =
        (req.headers["x-forwarded-for"] as string) ||
        req.socket.remoteAddress ||
        req.ip
    if (ip && ip.startsWith("::ffff:")) {
        ip = ip.replace("::ffff:", "")
    }
    return ip
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
