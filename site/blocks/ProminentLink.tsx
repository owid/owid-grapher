import * as React from "react"
import ReactDOM from "react-dom"
import * as ReactDOMServer from "react-dom/server"
import { observer } from "mobx-react"
import { computed } from "mobx"
import { union, getAttributesOfHTMLElement } from "../../clientUtils/Util"
import {
    getSelectedEntityNamesParam,
    migrateSelectedEntityNamesParam,
    setSelectedEntityNamesParam,
} from "../../grapher/core/EntityUrlBuilder"
import { SelectionArray } from "../../grapher/selection/SelectionArray"
import { Url } from "../../clientUtils/urls/Url"
import { EntityName } from "../../coreTable/OwidTableConstants"
import { BAKED_BASE_URL } from "../../settings/clientSettings"

export const PROMINENT_LINK_CLASSNAME = "wp-block-owid-prominent-link"

@observer
class ProminentLink extends React.Component<{
    originalAnchorAttributes: { [key: string]: string }
    innerHTML: string | null
    globalEntitySelection?: SelectionArray
}> {
    @computed get originalUrl(): Url {
        return migrateSelectedEntityNamesParam(
            Url.fromURL(this.props.originalAnchorAttributes.href)
        )
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
        return setSelectedEntityNamesParam(this.originalUrl, newEntityList)
    }

    render() {
        return (
            <a
                dangerouslySetInnerHTML={{ __html: this.props.innerHTML ?? "" }}
                {...this.props.originalAnchorAttributes}
                href={this.updatedUrl.fullUrl}
            />
        )
    }
}

const isStandaloneInternalLink = (el: CheerioElement, $: CheerioStatic) => {
    return (
        // Relies on formatLinks URL standardisation
        el.attribs.href.startsWith(BAKED_BASE_URL) &&
        el.parent.tagName === "p" &&
        !$(el).siblings().length
    )
}

export const renderProminentLink = ($: CheerioStatic) => {
    $("a").each((i, el) => {
        // detect internal links
        if (!isStandaloneInternalLink(el, $)) return

        // replace internal links with prominent links
        $(el).replaceWith(
            ReactDOMServer.renderToStaticMarkup(
                <div
                    className="wp-block-owid-prominent-link is-style-thin"
                    data-no-lightbox
                >
                    <a href={el.attribs.href}>
                        <div className="content-wrapper">
                            <div className="content">Test content</div>
                            {el.attribs.href}
                        </div>
                    </a>
                </div>
            )
        )
    })
}

export const hydrateProminentLink = (globalEntitySelection?: SelectionArray) =>
    document
        .querySelectorAll<HTMLElement>(`.${PROMINENT_LINK_CLASSNAME}`)
        .forEach((el) => {
            const anchorTag = el.querySelector("a")
            if (!anchorTag) return

            const rendered = (
                <ProminentLink
                    originalAnchorAttributes={getAttributesOfHTMLElement(
                        anchorTag
                    )}
                    innerHTML={anchorTag.innerHTML}
                    globalEntitySelection={globalEntitySelection}
                />
            )
            ReactDOM.hydrate(rendered, el)
        })
