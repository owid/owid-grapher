import * as React from "react"
import ReactDOM from "react-dom"
import { observer } from "mobx-react"
import { computed } from "mobx"
import { union } from "../../clientUtils/Util"
import {
    getSelectedEntityNamesParam,
    migrateSelectedEntityNamesParam,
    setSelectedEntityNamesParam,
} from "../../grapher/core/EntityUrlBuilder"
import { SelectionArray } from "../../grapher/selection/SelectionArray"
import { Url } from "../../clientUtils/urls/Url"
import { EntityName } from "../../coreTable/OwidTableConstants"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons/faArrowRight"

export const PROMINENT_LINK_CLASSNAME = "wp-block-owid-prominent-link"

export enum ProminentLinkStyles {
    thin = "is-style-thin",
    default = "is-style-default",
}

export const WITH_IMAGE = "with-image"

@observer
export class ProminentLink extends React.Component<{
    href: string
    style: string | null
    title: string | null
    content?: string | null
    image?: string | null
    globalEntitySelection?: SelectionArray
}> {
    @computed get originalUrl(): Url {
        return migrateSelectedEntityNamesParam(Url.fromURL(this.props.href))
    }

    @computed private get originalSelectedEntities(): EntityName[] {
        return getSelectedEntityNamesParam(this.originalUrl) ?? []
    }

    @computed private get entitiesInGlobalEntitySelection(): EntityName[] {
        return this.props.globalEntitySelection?.selectedEntityNames ?? []
    }

    @computed private get updatedUrl(): Url {
        const newEntityList = union(
            this.originalSelectedEntities,
            this.entitiesInGlobalEntitySelection
        )
        if (newEntityList.length === 0) return this.originalUrl

        return setSelectedEntityNamesParam(this.originalUrl, newEntityList)
    }

    @computed private get style(): string {
        return this.props.style || ProminentLinkStyles.default
    }

    render() {
        const classes = [
            PROMINENT_LINK_CLASSNAME,
            this.props.image ? WITH_IMAGE : null,
        ]

        const renderImage = () => {
            return this.props.image ? (
                <figure
                    dangerouslySetInnerHTML={{
                        __html: this.props.image,
                    }}
                />
            ) : null
        }

        const renderContent = () => {
            return this.props.content ? (
                <div
                    className="content"
                    dangerouslySetInnerHTML={{
                        __html: this.props.content,
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
                        {this.props.title ? (
                            <div className="title">
                                <span
                                    dangerouslySetInnerHTML={{
                                        __html: this.props.title,
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
                    {this.props.title ? (
                        <h3>
                            <span
                                dangerouslySetInnerHTML={{
                                    __html: this.props.title,
                                }}
                            />
                            <FontAwesomeIcon icon={faArrowRight} />
                        </h3>
                    ) : null}
                    <div className="content-wrapper">
                        {renderImage()}
                        {renderContent()}
                    </div>
                </>
            )
        }

        const target = this.updatedUrl.isGrapher ? { target: "_blank" } : {}

        return (
            <div
                className={classes.join(" ")}
                data-no-lightbox
                data-style={this.style}
                data-title={this.props.title}
            >
                <a href={this.updatedUrl.fullUrl} {...target}>
                    {this.style === ProminentLinkStyles.thin
                        ? renderThinStyle()
                        : renderDefaultStyle()}
                </a>
            </div>
        )
    }
}

export const hydrateProminentLink = (
    globalEntitySelection?: SelectionArray
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
                />
            )

            // this should be a hydrate() call, but it does not work on page
            // load for some reason (works fine when interacting with the global
            // entity selector afterwards). Maybe a race condition with Mobx?
            ReactDOM.render(rendered, block.parentElement)
        })
}
