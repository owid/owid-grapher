import React, { useContext } from "react"
import { observable, runInAction } from "mobx"
import { createContext, useState } from "react"
import {
    GdocsPatch,
    GdocsPatchOp,
    OwidArticleType,
} from "../clientUtils/owidTypes.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { Admin } from "./Admin.js"

export class GdocsStore {
    @observable gdocs: OwidArticleType[] = []
    @observable count: number = 0
    admin: Admin

    constructor(admin: Admin) {
        this.admin = admin
    }

    async create(id: string) {
        const gdoc = (await this.admin.requestJSON(
            `/api/gdocs/${id}`,
            {},
            "PUT"
        )) as OwidArticleType
        runInAction(() => this.gdocs.push(gdoc))
    }

    async update(gdoc: OwidArticleType, overridePatch?: GdocsPatch[]) {
        // todo simplify from the knowledge of update as a  single responsibility?
        const gdocsPatches: GdocsPatch[] = [
            {
                op: GdocsPatchOp.Update,
                property: "title",
                payload: gdoc.title,
            },
            {
                op: GdocsPatchOp.Update,
                property: "slug",
                payload: gdoc.slug,
            },
            {
                op: GdocsPatchOp.Update,
                property: "content",
                payload: gdoc.content,
            },
            ...(overridePatch ?? []),
        ]

        await this.admin.requestJSON(
            `/api/gdocs/${gdoc.id}`,
            gdocsPatches,
            "PATCH"
        )

        runInAction(() => {
            const gdocToUpdateIdx = this.gdocs.findIndex(
                (someGdoc) => someGdoc.id === gdoc.id
            )
            if (!gdocToUpdateIdx) return

            this.gdocs.splice(gdocToUpdateIdx, 1, gdoc)
        })
    }
}

const GdocsStoreContext = createContext<GdocsStore | undefined>(undefined)

export const GdocsStoreProvider = ({
    children,
}: {
    children: React.ReactNode
}) => {
    const { admin } = useContext(AdminAppContext)
    const [store] = useState(() => new GdocsStore(admin))

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
