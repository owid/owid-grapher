import { useContext, createContext, useState } from "react"
import * as React from "react"
import { action, observable } from "mobx"
import {
    getOwidGdocFromJSON,
    OwidGdocJSON,
    DbChartTagJoin,
    OwidGdoc,
    DbPlainTag,
    OwidGdocIndexItem,
} from "@ourworldindata/utils"
import { AdminAppContext } from "./AdminAppContext.js"
import { Admin } from "./Admin.js"
import {
    CreateTombstoneData,
    extractGdocIndexItem,
} from "@ourworldindata/types"

/**
 * This was originally a MobX data domain store (see
 * https://mobx.js.org/defining-data-stores.html) used to store the state of the
 * Google Docs index page. However, this index page currently only refreshes its
 * state on mount so keeping gdocs updated through mutations is unnecessary.
 * Today, this store acts as CRUD proxy for requests to API endpoints.
 */
export class GdocsStore {
    @observable gdocs: OwidGdocIndexItem[] = []
    @observable availableTags: DbChartTagJoin[] = []
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
        const item: OwidGdoc = await this.admin
            .requestJSON<OwidGdocJSON>(`/api/gdocs/${gdoc.id}`, gdoc, "PUT")
            .then(getOwidGdocFromJSON)
        const indexItem = extractGdocIndexItem(gdoc)
        const gdocToUpdateIndex = this.gdocs.findIndex((g) => g.id === gdoc.id)
        if (gdocToUpdateIndex >= 0) this.gdocs[gdocToUpdateIndex] = indexItem
        return item
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
    async delete(gdoc: OwidGdoc, tombstone?: CreateTombstoneData) {
        const body = tombstone ? { tombstone } : {}
        await this.admin.requestJSON(`/api/gdocs/${gdoc.id}`, body, "DELETE")
    }

    @action
    async fetchGdocs() {
        const gdocs = (await this.admin.getJSON(
            "/api/gdocs"
        )) as OwidGdocIndexItem[]
        this.gdocs = gdocs
    }

    @action
    async fetchTags() {
        const json = (await this.admin.getJSON("/api/tags.json")) as any
        this.availableTags = json.tags
    }

    @action
    async updateTags(gdoc: OwidGdocIndexItem, tags: DbPlainTag[]) {
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
