import React from "react"
import { Head } from "../Head.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"
import {
    COLLECTIONS_PAGE_CONTAINER_ID,
    SiteFooterContext,
} from "@ourworldindata/utils"

import { SharedCollection } from "./SharedCollection.js"
import { ObservableMap } from "mobx"
import { Grapher } from "@ourworldindata/grapher"

type OriginalSlug = string

/**
 * `index` is the original index of the Grapher when the page was loaded.
 * This is needed so that when we reserialize the map to query strings, we can put them back in the same order.
 * We can't use an Array or Set because Grapher mounting happens in an arbitrary order,
 * so we need some way to keep track of the original order via their original slugs.
 *
 * `grapher` is the Grapher object itself.
 */
export interface WindowGrapherRecord {
    index: number
    grapher: Grapher | undefined
}

export type WindowGraphers = ObservableMap<OriginalSlug, WindowGrapherRecord>

declare global {
    interface Window {
        graphers: WindowGraphers
    }
}

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
