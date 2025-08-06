// https://github.com/testing-library/jest-dom#with-vitest
import "@testing-library/jest-dom/vitest"

// https://testing-library.com/docs/react-testing-library/setup#auto-cleanup-in-vitest
import { cleanup } from "@testing-library/react"
import { afterEach, beforeEach } from "vitest"

afterEach(() => {
    cleanup()
})

const loggers = ["log", "debug", "trace", "info", "warn", "error"] as const

type LogFunction = (...args: any) => void
type LoggedInvocation = [LogFunction, any[]]

beforeEach((ctx) => {
    const logs: LoggedInvocation[] = []

    const original: Record<string, LogFunction> = {}
    for (const logger of loggers) {
        original[logger] = console[logger]
        console[logger] = (...args) => logs.push([original[logger], args])
    }

    ctx.onTestFailed(() => {
        for (const [logger, data] of logs) {
            logger.call(console, ...data)
        }
    })

    return () => {
        for (const logger of loggers) {
            console[logger] = original[logger]
        }
    }
})
