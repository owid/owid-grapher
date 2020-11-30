type Handler = () => any
const handlers: Handler[] = []

export const cleanup = async () => await Promise.all(handlers)

export const exit = async () => {
    try {
        await cleanup()
        process.exit(0)
    } catch (err) {
        console.error(err)
        process.exit(1)
    }
}

export const registerExitHandler = (fn: Handler) => handlers.push(fn)

process.on("SIGINT", exit)
process.on("SIGTERM", exit)
