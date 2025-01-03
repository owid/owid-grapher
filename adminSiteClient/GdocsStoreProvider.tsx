import React, { useContext, useState } from "react"
import { AdminAppContext } from "./AdminAppContext.js"
import { GdocsStore } from "./GdocsStore.js"
import { GdocsStoreContext } from "./GdocsStoreContext.js"

export function GdocsStoreProvider({
    children,
}: {
    children: React.ReactNode
}) {
    const { admin } = useContext(AdminAppContext)
    const [store] = useState(() => new GdocsStore(admin))

    return (
        <GdocsStoreContext.Provider value={store}>
            {children}
        </GdocsStoreContext.Provider>
    )
}
