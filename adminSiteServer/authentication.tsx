import express from "express"
import crypto from "crypto"
import randomstring from "randomstring"
import * as db from "../db/db.js"
import {
    CLOUDFLARE_AUD,
    SECRET_KEY,
    SESSION_COOKIE_AGE,
    ADMIN_BASE_URL,
    ENV,
} from "../settings/serverSettings.js"
import { BCryptHasher } from "../db/hashers.js"
import { Secret, verify } from "jsonwebtoken"
import { DbPlainSession, DbPlainUser, JsonError } from "@ourworldindata/utils"
import { exec } from "child_process"

export type Request = express.Request

export interface Response extends express.Response {
    locals: { user: DbPlainUser; session: Session }
}

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

    // Get the Cloudflare public key
    const certsUrl = "https://owid.cloudflareaccess.com/cdn-cgi/access/certs"
    const response = await fetch(certsUrl)
    const certs = await response.json()
    const publicCerts = certs.public_certs
    if (!publicCerts) {
        console.error("Missing public certificates from Cloudflare.")
        return next()
    }
    // Verify the JWT token
    let certVerificationErr
    let payload: any
    const verified = publicCerts.some((certObj: { cert: Secret }) => {
        try {
            payload = verify(jwt, certObj.cert, {
                audience: audTag,
                algorithms: ["RS256"],
            })
            return true
        } catch (err) {
            certVerificationErr = err
        }
        return false
    })

    if (!verified) {
        // Authorization token invalid: verification failed, token expired or wrong audience.
        console.error(certVerificationErr)
        return next()
    }

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
    if (!user) return next("User not found. Please contact an administrator.")

    // Authenticate as the user stored in the token
    const { id: sessionId } = await logInAsUser(user)
    res.cookie("sessionid", sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: ENV === "production",
    })

    // Prevents redirect to external URLs
    let redirectTo = "/admin"
    if (req.query.next) {
        try {
            redirectTo = new URL(req.query.next as string, ADMIN_BASE_URL)
                .pathname
        } catch (err) {
            console.error(err)
        }
    }
    return res.redirect(redirectTo)
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

                const rows = await db.knexRaw<DbPlainSession>(
                    trx,
                    `SELECT * FROM sessions WHERE session_key = ?`,
                    [sessionid]
                )
                if (rows.length) {
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
                    if (!user)
                        throw new JsonError(
                            "Invalid session (no such user)",
                            500
                        )
                    const session = {
                        id: sessionid,
                        expiryDate: rows[0].expire_date,
                    }

                    await trx
                        .table("users")
                        .where({ id: user.id })
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
        return next()
    } else if (!req.path.startsWith("/admin") || req.path === "/admin/login")
        return next()

    return res.redirect(`/admin/login?next=${encodeURIComponent(req.url)}`)
}

function saltedHmac(salt: string, value: string): string {
    const hmac = crypto.createHmac("sha1", salt + SECRET_KEY)
    hmac.update(value)
    return hmac.digest("hex")
}

export async function logInAsUser(user: Pick<DbPlainUser, "email" | "id">) {
    const sessionId = randomstring.generate()

    const sessionJson = JSON.stringify({
        user_email: user.email,
    })
    const sessionHash = saltedHmac(
        "django.contrib.sessions.SessionStore",
        sessionJson
    )
    const sessionData = Buffer.from(`${sessionHash}:${sessionJson}`).toString(
        "base64"
    )

    const now = new Date()
    const expiryDate = new Date(now.getTime() + 1000 * SESSION_COOKIE_AGE)

    await db.knexReadWriteTransaction(async (trx) => {
        await db.knexRaw(
            trx,
            `INSERT INTO sessions (session_key, session_data, expire_date) VALUES (?, ?, ?)`,
            [sessionId, sessionData, expiryDate]
        )

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

    // Get Tailscale IP-to-User mapping
    const ipToUserMap = await getTailscaleIpToUserMap()

    // Get the Tailscale display name / github username associated with the client's IP address
    const githubUserName = ipToUserMap[clientIp]

    // Next if user is not found, user can still log in as admin
    if (!githubUserName) {
        return next()
    }

    const user = await db
        .knexInstance()
        .table("users")
        .where({ fullName: githubUserName })
        .first()
    if (!user) {
        console.error(
            `User with name ${githubUserName} not found in MySQL. Please change your Github profile name to match your MySQL user.`
        )
        return next()
    }

    // Authenticate as the user stored in the token
    const { id: sessionId } = await logInAsUser(user)
    res.cookie("sessionid", sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: ENV === "production",
    })

    // Save the sessionid in cookies for `authMiddleware` to log us in
    req.cookies["sessionid"] = sessionId

    return next()
}

function getClientIp(req: express.Request): string {
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
    return new Promise((resolve) => {
        exec("tailscale status --json", (error, stdout) => {
            if (error) {
                console.error(`Error getting Tailscale status: ${error}`)
                return resolve({})
            }
            const tailscaleStatus: TailscaleStatus = JSON.parse(stdout)
            const ipToUser: Record<string, string> = {}

            // Map UserIDs to LoginNames
            const userIdToDisplayName: Record<string, string> = {}

            if (tailscaleStatus.User) {
                for (const [userId, userInfo] of Object.entries(
                    tailscaleStatus.User
                )) {
                    if (userInfo.DisplayName) {
                        userIdToDisplayName[parseInt(userId)] =
                            userInfo.DisplayName
                    }
                }
            }

            // Include Peers
            if (tailscaleStatus.Peer) {
                for (const peer of Object.values(tailscaleStatus.Peer)) {
                    if (peer.UserID in userIdToDisplayName) {
                        const displayName = userIdToDisplayName[peer.UserID]
                        for (const ip of peer.TailscaleIPs) {
                            ipToUser[ip] = displayName
                        }
                    }
                }
            }

            resolve(ipToUser)
        })
    })
}
