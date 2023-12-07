import React, { useContext, createContext, useState } from "react"
import { action, observable } from "mobx"
import {
    getOwidGdocFromJSON,
    omit,
    OwidGdocJSON,
    Tag,
    OwidGdoc,
} from "@ourworldindata/utils"
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
    @observable gdocs: OwidGdoc[] = []
    @observable availableTags: Tag[] = []
    admin: Admin

    constructor(admin: Admin) {
        this.admin = admin
    }

    @action
    async create(id: string) {
        await this.admin.requestJSON(`/api/gdocs/${id}`, {}, "PUT")
    }

    @action
    async update(gdoc: OwidGdoc): Promise<OwidGdoc> {
        return this.admin
            .requestJSON<OwidGdocJSON>(
                `/api/gdocs/${gdoc.id}`,
                // omitting tags because they get saved via the /api/gdocs/:id/setTags route, not this /api/gdocs/:id route
                // If we were to save them here, it could lead to updates from this request
                // overwriting tags that had been set by someone else after the preview page was loaded
                omit(gdoc, "tags"),
                "PUT"
            )
            .then(getOwidGdocFromJSON)
    }

    @action
    async publish(gdoc: OwidGdoc): Promise<OwidGdoc> {
        const publishedGdoc = await this.update({ ...gdoc, published: true })
        return publishedGdoc
    }

    @action
    async unpublish(gdoc: OwidGdoc): Promise<OwidGdoc> {
        const unpublishedGdoc = await this.update({
            ...gdoc,
            publishedAt: null,
            published: false,
        })

        return unpublishedGdoc
    }

    @action
    async delete(gdoc: OwidGdoc) {
        await this.admin.requestJSON(`/api/gdocs/${gdoc.id}`, {}, "DELETE")
    }

    @action
    async fetchGdocs() {
        const gdocs = (await this.admin.getJSON("/api/gdocs")) as OwidGdoc[]
        this.gdocs = gdocs
    }

    @action
    async fetchTags() {
        const json = (await this.admin.getJSON("/api/tags.json")) as any
        this.availableTags = json.tags
    }

    @action
    async updateTags(gdoc: OwidGdoc, tags: Tag[]) {
        const json = await this.admin.requestJSON(
            `/api/gdocs/${gdoc.id}/setTags`,
            { tagIds: tags.map((t) => t.id) },
            "POST"
        )
        if (json.success) {
            const gdocToUpdate = this.gdocs.find((g) => g.id === gdoc.id)
            if (gdocToUpdate) gdocToUpdate.tags = tags
        }
    }
}

export const GdocsStoreContext = createContext<GdocsStore | undefined>(
    undefined
)

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
