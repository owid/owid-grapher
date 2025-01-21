import dotenv from "dotenv"
import * as Sentry from "@sentry/node"
import { nodeProfilingIntegration } from "@sentry/profiling-node"
import findBaseDir from "../settings/findBaseDir.js"

const baseDir = findBaseDir(__dirname)
if (baseDir === undefined) throw new Error("could not locate base package.json")

dotenv.config({ path: `${baseDir}/.env` })

// Ensure to call this before importing any other modules!
Sentry.init({
    dsn: process.env.SENTRY_ADMIN_DSN,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: 0.1,
    profilesSampleRate: 1.0, // This is relative to tracesSampleRate
    environment: process.env.ENV,
    release: process.env.COMMIT_SHA,
})
