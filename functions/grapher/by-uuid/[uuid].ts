// The handler's code (grapher library, React SSR) is imported lazily so that a
// new isolate doesn't evaluate it unless it serves this route.
export const onRequest: PagesFunction = async (context) => {
    const { handleGrapherByUuidRequest } =
        await import("../../_common/lazyRoutes/grapherByUuid.js")
    return handleGrapherByUuidRequest(context)
}
