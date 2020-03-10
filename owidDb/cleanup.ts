type Handler = () => any

const handlers: Handler[] = []

process.on("SIGINT", exit)
process.on("SIGTERM", exit)

export async function cleanup() {
    await Promise.all(handlers)
}

export async function exit() {
    try {
        await cleanup()
        process.exit(0)
    } catch (err) {
        console.error(err)
        process.exit(1)
    }
}

export function registerExitHandler(fn: Handler) {
    handlers.push(fn)
}
