import React, { useEffect, useState } from "react"
import ReactDOM from "react-dom"
import { union } from "../../clientUtils/Util.js"
import {
    getSelectedEntityNamesParam,
    migrateSelectedEntityNamesParam,
    setSelectedEntityNamesParam,
} from "../../grapher/core/EntityUrlBuilder.js"
import { SelectionArray } from "../../grapher/selection/SelectionArray.js"
import { Url } from "../../clientUtils/urls/Url.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons/faArrowRight"
import { DEFAULT_GRAPHER_WIDTH } from "../../grapher/core/GrapherConstants.js"
import { GlightboxApi } from "glightbox"
import { autorun } from "mobx"
import { observer, useStaticRendering } from "mobx-react-lite"

export const PROMINENT_LINK_CLASSNAME = "wp-block-owid-prominent-link"

export enum ProminentLinkStyles {
    thin = "is-style-thin",
    default = "is-style-default",
}

export const WITH_IMAGE = "with-image"

// Fixes the useLayoutEffect warning triggered by observer() running on the server
// Probably not needed with Mobx 6
// https://mobx-react.js.org/recipes-ssr
if (typeof window === "undefined") {
    useStaticRendering(true)
}

export const ProminentLink = observer(
    ({
        href,
        style = ProminentLinkStyles.default,
        title,
        content,
        image,
        globalEntitySelection,
        gallery,
        galleryId,
    }: {
        href: string
        style: string | null
        title: string | null
        content?: string | null
        image?: string | null
        globalEntitySelection?: SelectionArray
        gallery?: GlightboxApi
        galleryId?: string
    }) => {
        const originalUrl = migrateSelectedEntityNamesParam(Url.fromURL(href))
        const [updatedUrl, setUpdatedUrl] = useState(originalUrl)

        useEffect(
            () =>
                autorun(() => {
                    const originalSelectedEntities =
                        getSelectedEntityNamesParam(originalUrl) ?? []

                    const entitiesInGlobalEntitySelection =
                        globalEntitySelection?.selectedEntityNames ?? []

                    const newEntityList = union(
                        originalSelectedEntities,
                        entitiesInGlobalEntitySelection
                    )

                    setUpdatedUrl(
                        newEntityList.length === 0
                            ? originalUrl
                            : setSelectedEntityNamesParam(
                                  originalUrl,
                                  newEntityList
                              )
                    )
                }),
            []
        )

        useEffect(() => {
            // optim: see possible optimization in hydratePromminentLinks()
            gallery?.reload()
        }, [updatedUrl])

        const classes = [PROMINENT_LINK_CLASSNAME, image ? WITH_IMAGE : null]

        const renderImage = () => {
            return image ? (
                <figure
                    dangerouslySetInnerHTML={{
                        __html: image,
                    }}
                />
            ) : null
        }

        const renderContent = () => {
            return content ? (
                <div
                    className="content"
                    dangerouslySetInnerHTML={{
                        __html: content,
                    }}
                />
            ) : null
        }

        const renderThinStyle = () => {
            return (
                <>
                    {renderImage()}
                    <div className="content-wrapper">
                        {renderContent()}
                        {title ? (
                            <div className="title">
                                <span
                                    dangerouslySetInnerHTML={{
                                        __html: title,
                                    }}
                                />
                                <FontAwesomeIcon icon={faArrowRight} />
                            </div>
                        ) : null}
                    </div>
                </>
            )
        }

        const renderDefaultStyle = () => {
            return (
                <>
                    {renderImage()}
                    <div className="content-wrapper">
                        {title ? (
                            <h3>
                                <span
                                    dangerouslySetInnerHTML={{
                                        __html: title,
                                    }}
                                />
                                <FontAwesomeIcon icon={faArrowRight} />
                            </h3>
                        ) : null}
                        {renderContent()}
                    </div>
                </>
            )
        }

        const target = updatedUrl.isGrapher ? { target: "_blank" } : {}

        return (
            <div
                className={classes.join(" ")}
                data-no-lightbox
                data-style={style}
                data-title={title}
            >
                <a
                    href={updatedUrl.fullUrl}
                    // see .related-research-data width
                    data-width={`${DEFAULT_GRAPHER_WIDTH + 300}`}
                    {...target}
                >
                    {style === ProminentLinkStyles.thin
                        ? renderThinStyle()
                        : renderDefaultStyle()}
                </a>
            </div>
        )
    }
)
export const hydrateProminentLink = (
    globalEntitySelection?: SelectionArray,
    globalGallery?: GlightboxApi
) => {
    document
        .querySelectorAll<HTMLElement>(`.${PROMINENT_LINK_CLASSNAME}`)
        .forEach((block) => {
            const href = block.querySelector("a")?.href
            if (!href) return

            const style = block.getAttribute("data-style")
            const title = block.getAttribute("data-title")
            const content = block.querySelector(".content")?.innerHTML || null
            const image = block.querySelector("figure")?.innerHTML || null

            const rendered = (
                <ProminentLink
                    href={href}
                    style={style}
                    title={title}
                    content={content}
                    image={image}
                    globalEntitySelection={globalEntitySelection}
                    gallery={globalGallery}
                />
            )

            ReactDOM.hydrate(rendered, block.parentElement)
        })

    // This is an optimization to run the prominent link gallery code once per
    // update of the selected entities in the global country selector.
    // Technically, reloading in an effect in every promient links works too.

    // reaction(
    //     () => globalEntitySelection?.selectedEntityNames,
    //     () => {
    //         // Hack: without the setTimeout, there seems to be a race condition
    //         // by which prominent link urls are updated before the reload can
    //         // happen
    //         setTimeout(() => globalGallery.reload())
    //     },
    //     { fireImmediately: true }
    // )
}
