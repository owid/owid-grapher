import React from "react"
import { observable } from "mobx"
import { createContext, useState } from "react"
import { OwidArticleType } from "../clientUtils/owidTypes.js"

export class GdocsStore {
    @observable gdocs: OwidArticleType[] = []
    @observable count: number = 0

    addGdoc(gdoc: OwidArticleType) {
        this.gdocs.push(gdoc)
    }
}

const GdocsStoreContext = createContext<GdocsStore | undefined>(undefined)

export const GdocsStoreProvider = ({
    children,
}: {
    children: React.ReactNode
}) => {
    const [store] = useState(() => new GdocsStore())

    return (
        <GdocsStoreContext.Provider value={store}>
            {children}
        </GdocsStoreContext.Provider>
    )
}

export const useGdocsStore = () => {
    const context = React.useContext(GdocsStoreContext)
    if (context === undefined) {
        throw new Error(
            "useGdocsStore must be used within a GdocsStoreProvider"
        )
    }
    return context
}
