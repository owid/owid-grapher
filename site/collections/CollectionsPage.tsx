import React from "react"
import { Head } from "../Head.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"
import {
    COLLECTIONS_PAGE_CONTAINER_ID,
    SiteFooterContext,
} from "@ourworldindata/utils"

import { SharedCollection } from "./SharedCollection.js"

export const COLLECTIONS_LOCAL_STORAGE_KEY = "collections"

export const SharedCollectionPage = (props: { baseUrl: string }) => {
    const { baseUrl } = props

    return (
        <html>
            <Head
                canonicalUrl={`${baseUrl}/shared-collection`}
                pageTitle="Chart Collection"
                pageDesc="View charts you've saved on Our World in Data."
                baseUrl={baseUrl}
            />
            <body>
                <SiteHeader baseUrl={baseUrl} />
                <main className="collections-page grid grid-cols-12-full-width">
                    <div
                        id={COLLECTIONS_PAGE_CONTAINER_ID}
                        className="grid span-cols-12 col-start-2"
                    >
                        <SharedCollection baseUrl={baseUrl} />
                    </div>
                </main>
                <SiteFooter
                    hideDonate={true}
                    baseUrl={baseUrl}
                    context={SiteFooterContext.collectionsPage}
                />
            </body>
        </html>
    )
}
