import * as React from "react"
import ReactDOM from "react-dom"
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

export const renderProminentLink = (globalEntitySelection?: SelectionArray) =>
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

            ReactDOM.render(rendered, el)
        })
