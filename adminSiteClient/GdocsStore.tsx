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

    async publish(gdoc: OwidArticleType, isLightningDeploy: boolean) {
        const publishedGdoc = {
            ...gdoc,
            published: true,
            // Add today's date if the publication date is missing
            publishedAt: gdoc.publishedAt ?? new Date(),
        }
        await this.update(publishedGdoc)

        if (isLightningDeploy) {
            await this.admin.requestJSON(`/api/deploy/${gdoc.slug}`, {}, "PUT")
        } else {
            await this.admin.requestJSON(`/api/deploy`, {}, "PUT")
        }

        return publishedGdoc
    }

    async unpublish(gdoc: OwidArticleType) {
        const unpublishedGdoc = {
            ...gdoc,
            published: false,
        }
        await this.update(unpublishedGdoc)

        await this.admin.requestJSON(`/api/deploy`, {}, "PUT")

        return unpublishedGdoc
    }

    async delete(gdoc: OwidArticleType) {
        runInAction(() => {
            const gdocToDeleteIdx = this.gdocs.findIndex(
                (someGdoc) => someGdoc.id === gdoc.id
            )
            if (!gdocToDeleteIdx) return

            this.gdocs.splice(gdocToDeleteIdx, 1)
        })

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
