import React, { useContext } from "react"
import { observable } from "mobx"
import { createContext, useState } from "react"
import { OwidArticleType } from "../clientUtils/owidTypes.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { Admin } from "./Admin.js"

/**
 * This was originally a MobX data domain store (see
 * https://mobx.js.org/defining-data-stores.html) used to store the state of the
 * Google Docs index page. However, this index page currently only refreshes its
 * state on mount so keeping gdocs updated through mutations is unnecessary.
 * Today, this store acts as CRUD proxy for requests to API endpoints.
 */
export class GdocsStore {
    @observable gdocs: OwidArticleType[] = []
    admin: Admin

    constructor(admin: Admin) {
        this.admin = admin
    }

    async create(id: string) {
        await this.admin.requestJSON(`/api/gdocs/${id}`, {}, "PUT")
    }

    async update(gdoc: OwidArticleType) {
        await this.admin.requestJSON(`/api/gdocs/${gdoc.id}`, gdoc, "PUT")
    }

    async publish(gdoc: OwidArticleType) {
        const publishedGdoc = {
            ...gdoc,
            published: true,
            // Add today's date if the publication date is missing
            publishedAt: gdoc.publishedAt ?? new Date(),
        }

        await this.update(publishedGdoc)

        return publishedGdoc
    }

    async unpublish(gdoc: OwidArticleType) {
        const unpublishedGdoc = {
            ...gdoc,
            published: false,
        }

        await this.update(unpublishedGdoc)

        return unpublishedGdoc
    }

    async delete(gdoc: OwidArticleType) {
        await this.admin.requestJSON(`/api/gdocs/${gdoc.id}`, {}, "DELETE")
        await this.admin.requestJSON(`/api/deploy`, {}, "PUT")
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
