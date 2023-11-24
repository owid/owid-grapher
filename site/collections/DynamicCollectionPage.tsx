import React from "react"
import { Head } from "../Head.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"
import {
    DYNAMIC_COLLECTION_PAGE_CONTAINER_ID,
    SiteFooterContext,
} from "@ourworldindata/utils"

import { DynamicCollection } from "./DynamicCollection.js"
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

export const DynamicCollectionPage = (props: { baseUrl: string }) => {
    const { baseUrl } = props

    return (
        <html>
            <Head
                canonicalUrl={`${baseUrl}/collection/custom`}
                pageTitle="Chart Collection"
                pageDesc="View charts you've saved on Our World in Data."
                baseUrl={baseUrl}
            />
            <body>
                <SiteHeader baseUrl={baseUrl} />
                <main className="collections-page grid grid-cols-12-full-width">
                    <header className="collections-page__header grid grid-cols-12-full-width span-cols-14">
                        <h1 className="display-2-semibold span-cols-12 col-start-2 collection-title">
                            Custom Collection
                        </h1>
                        <p className="span-cols-8 col-start-2 span-md-cols-12 col-md-start-2 body-1-regular collection-explanation">
                            This page is displaying a selection of charts that
                            has been configured via the URL.{" "}
                        </p>
                        <p className="span-cols-8 col-start-2 span-md-cols-12 col-md-start-2 body-1-regular collection-explanation">
                            Any changes that you make to the charts will update
                            the URL so that you can easily share it again.
                        </p>
                    </header>
                    <div
                        id={DYNAMIC_COLLECTION_PAGE_CONTAINER_ID}
                        className="grid span-cols-12 col-start-2"
                    >
                        <DynamicCollection baseUrl={baseUrl} />
                    </div>
                </main>
                <SiteFooter
                    hideDonate={true}
                    baseUrl={baseUrl}
                    context={SiteFooterContext.dynamicCollectionPage}
                />
            </body>
        </html>
    )
}
