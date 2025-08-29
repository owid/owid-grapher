import * as Sentry from "@sentry/node"
import express from "express"
import crypto from "crypto"
import * as db from "../db/db.js"
import {
    CLOUDFLARE_AUD,
    SESSION_COOKIE_AGE,
    ADMIN_BASE_URL,
    ENV,
} from "../settings/serverSettings.js"
import { BCryptHasher } from "../db/hashers.js"
import * as jose from "jose"
import { DbPlainUser, JsonError } from "@ourworldindata/utils"
import { execWrapper } from "../db/execWrapper.js"
import * as _ from "lodash-es"

export type Request = express.Request

export type Response = express.Response<
    any,
    { user: DbPlainUser; session: Session }
>

interface Session {
    id: string
    expiryDate: Date
}

const CLOUDFLARE_COOKIE_NAME = "CF_Authorization"

/*
 * See authentication.php for detailed descriptions.
 */
export async function authCloudflareSSOMiddleware(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) {
    const jwt = req.cookies[CLOUDFLARE_COOKIE_NAME]
    if (!jwt) return next()

    const audTag = CLOUDFLARE_AUD
    if (!audTag) {
        console.error(
            "Missing or empty audience tag. Please add CLOUDFLARE_AUD key in settings."
        )
        return next()
    }

    // Validate the JWT token using the public key from Cloudflare Access
    // see https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/#javascript-example
    const teamDomain = "https://owid.cloudflareaccess.com"
    const certsUrl = `${teamDomain}/cdn-cgi/access/certs`

    const jwks = jose.createRemoteJWKSet(new URL(certsUrl))

    let verified: jose.JWTVerifyResult<jose.JWTPayload>
    try {
        verified = await jose.jwtVerify(jwt, jwks, {
            audience: audTag,
            issuer: teamDomain,
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
        .first()
    if (!user) {
        console.error(
            `User with email ${payload.email} not found. Please contact an administrator.`
        )
        return next()
    }

    // Authenticate as the user stored in the token
    const { id: sessionId } = await logInAsUser(user)
    res.cookie("sessionid", sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: ENV !== "development",
    })

    // Prevents redirect to external URLs
    return res.redirect(
        getSafeRedirectUrl(req.query.next as string | undefined)
    )
}

export async function logOut(req: express.Request, res: express.Response) {
    if (res.locals.user)
        await db.knexReadWriteTransaction((trx) =>
            db.knexRaw(trx, `DELETE FROM sessions WHERE session_key = ?`, [
                res.locals.session.id,
            ])
        )

    res.clearCookie("sessionid")
    res.clearCookie(CLOUDFLARE_COOKIE_NAME)
    return res.redirect("/admin")
}

export async function authMiddleware(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) {
    let user: DbPlainUser | null = null
    let session: Session | undefined

    const sessionid = req.cookies["sessionid"]
    if (sessionid) {
        const userAndSession = await db.knexReadWriteTransaction(
            async (trx) => {
                // Expire old sessions
                await db.knexRaw(
                    trx,
                    "DELETE FROM sessions WHERE expire_date < NOW()"
                )

                const userAndExpiryDate = await db.knexRawFirst<
                    DbPlainUser & { expiryDate: Date }
                >(
                    trx,
                    `SELECT u.*, s.expire_date AS expiryDate
                    FROM sessions s
                    LEFT JOIN users u ON u.id = s.user_id
                    WHERE s.session_key = ?`,
                    [sessionid]
                )
                if (userAndExpiryDate) {
                    const { expiryDate, ...user } = userAndExpiryDate
                    if (_.isNil(user.id)) {
                        throw new JsonError(
                            "Invalid session (no such user)",
                            500
                        )
                    }

                    const session = {
                        id: sessionid,
                        expiryDate,
                    }

                    await trx
                        .table("users")
                        .where({ id: userAndExpiryDate.id })
                        .update({ lastSeen: new Date() })
                    return { user, session }
                }
                return null
            }
        )
        user = userAndSession?.user ?? null
        session = userAndSession?.session
    }

    // Authed urls shouldn't be cached
    res.set("Cache-Control", "private, no-cache")

    if (user?.isActive) {
        res.locals.session = session
        res.locals.user = user

        Sentry.setUser({
            email: user.email,
            username: user.fullName,
        })

        return next()
    } else if (!req.path.startsWith("/admin") || req.path === "/admin/login")
        return next()

    return res.redirect(`/admin/login?next=${encodeURIComponent(req.url)}`)
}

// Prevents redirect to external URLs
export function getSafeRedirectUrl(nextUrl: string | undefined) {
    if (!nextUrl) return "/admin"
    try {
        const redirectUrl = new URL(nextUrl, ADMIN_BASE_URL)
        if (!redirectUrl.pathname.startsWith("/")) {
            throw new Error(
                `Invalid redirect URL: ${nextUrl}. Redirecting to /admin.`
            )
        }
        return redirectUrl.pathname + redirectUrl.search + redirectUrl.hash
    } catch (err) {
        console.error(err)
        return "/admin"
    }
}

export async function logInAsUser(user: Pick<DbPlainUser, "email" | "id">) {
    // Create a random string of 32 characters. Use base64url because that one's cookie-safe without any issues.
    const sessionId = crypto
        .randomBytes(32)
        .toString("base64url")
        .substring(0, 32)

    const now = new Date()
    const expiryDate = new Date(now.getTime() + 1000 * SESSION_COOKIE_AGE)

    await db.knexReadWriteTransaction(async (trx) => {
        await trx.table("sessions").insert({
            session_key: sessionId,
            user_id: user.id,
            expire_date: expiryDate,
        })

        await trx
            .table("users")
            .where({ id: user.id })
            .update({ lastLogin: now })
    })

    return { id: sessionId, expiryDate: expiryDate }
}

export async function logInWithCredentials(
    email: string,
    password: string
): Promise<Session> {
    // Here in the middleware we don't have access to the transaction yet so we get a knexinstance manually
    const user = await db.knexInstance().table("users").where({ email }).first()

    if (!user) throw new Error("No such user")

    const hasher = new BCryptHasher()
    if (await hasher.verify(password, user.password))
        // Login successful
        return logInAsUser(user)

    throw new Error("Invalid password")
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

export async function tailscaleAuthMiddleware(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) {
    // If there's a sessionid in cookies, proceed to `authMiddleware` middleware
    if (req.cookies["sessionid"]) {
        return next()
    }

    // Extract client's IP address
    const clientIp = getClientIp(req)

    if (!clientIp) {
        console.error("Could not determine client IP address.")
        return next()
    }

    // Get Tailscale IP-to-User mapping
    const ipToUserMap = await getTailscaleIpToUserMap()

    // Get the Tailscale display name / github username associated with the client's IP address
    const githubUserName = ipToUserMap[clientIp]

    // Next if user is not found, user can still log in as admin
    if (!githubUserName) {
        return next()
    }

    let user
    try {
        // Look up user by 'githubUsername'
        user = await db
            .knexInstance()
            .table("users")
            .where({ githubUsername: githubUserName })
            .first()
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

    // Authenticate as the user stored in the token
    const { id: sessionId } = await logInAsUser(user)
    res.cookie("sessionid", sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: ENV !== "development",
    })

    // Save the sessionid in cookies for `authMiddleware` to log us in
    req.cookies["sessionid"] = sessionId

    return next()
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
