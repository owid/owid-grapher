type Handler = () => any
const handlers: Handler[] = []

export const cleanup = async (): Promise<Handler[]> =>
    await Promise.all(handlers)

export const exit = async (): Promise<never> => {
    try {
        await cleanup()
        process.exit(0)
    } catch (err) {
        console.error(err)
        process.exit(1)
    }
}

export const registerExitHandler = (fn: Handler): number => handlers.push(fn)

process.on("SIGINT", exit)
process.on("SIGTERM", exit)
