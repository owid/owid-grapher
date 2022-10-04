import React, { useContext } from "react"
import { observable, runInAction } from "mobx"
import { createContext, useState } from "react"
import { GdocsPatch, OwidArticleType } from "../clientUtils/owidTypes.js"
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

    async update(gdoc: OwidArticleType) {
        // todo: simplify by iterating over all properties?
        const gdocsPatches: GdocsPatch[] = [
            {
                property: "slug",
                payload: gdoc.slug,
            },
            {
                property: "content",
                payload: gdoc.content,
            },
            {
                property: "published",
                payload: gdoc.published,
            },
            {
                property: "publishedAt",
                payload: gdoc.publishedAt,
            },
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

    async delete(gdoc: OwidArticleType) {
        await this.admin.requestJSON(`/api/gdocs/${gdoc.id}`, {}, "DELETE")

        runInAction(() => {
            const gdocToDeleteIdx = this.gdocs.findIndex(
                (someGdoc) => someGdoc.id === gdoc.id
            )
            if (!gdocToDeleteIdx) return

            this.gdocs.splice(gdocToDeleteIdx, 1)
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
