import React, { createContext, useState } from "react"

/*
We rely on the <OwidArticle> being wrapped around a <DebugProvider> to indicate
whether we want to turn on error boundary debugging. For that, we don't need the
context to hold any information, hence the type "true" below (could be any other
value). 

<DebugProvider> is only used when the article is previewed (see
GdocsPreviewPage). When the article is baked or rendered through the mockServer,
<OwidArticle> is rendered as-is. Error boundaries do not catch errors on SSR
either way, but we might still want to catch client-side errors in the future.
*/

const DebugContext = createContext<true | undefined>(undefined)

export const DebugProvider = ({ children }: { children: React.ReactNode }) => {
    return (
        <DebugContext.Provider value={true}>{children}</DebugContext.Provider>
    )
}

export const useDebug = () => {
    const context = React.useContext(DebugContext)

    // This will come handy when the context is used in more scenarios, with a
    // payload, to simplify existence checks in consumers. Right now, the
    // absence of context is a feature (see above).

    //if (context === undefined) {
    // throw new Error("useDebug must be used within a DebugProvider")
    // }
    return context
}
