import * as React from "react"
import ReactDOM from "react-dom"
import { observer } from "mobx-react"
import { computed } from "mobx"
import {
    strToQueryParams,
    queryParamsToStr,
    splitURLintoPathAndQueryString,
    QueryParams,
} from "utils/client/url"
import { union, isEmpty, getAttributesOfHTMLElement } from "clientUtils/Util"
import { EntityUrlBuilder } from "grapher/core/EntityUrlBuilder"
import { GlobalEntityControl } from "grapher/controls/globalEntityControl/GlobalEntityControl"

export const PROMINENT_LINK_CLASSNAME = "wp-block-owid-prominent-link"

@observer
class ProminentLink extends React.Component<{
    originalAnchorAttributes: { [key: string]: string }
    innerHTML: string | null
}> {
    @computed get originalURLPath() {
        return splitURLintoPathAndQueryString(
            this.props.originalAnchorAttributes.href
        ).path
    }

    @computed private get originalURLQueryString(): string | undefined {
        return splitURLintoPathAndQueryString(
            this.props.originalAnchorAttributes.href
        ).queryString
    }

    @computed private get originalURLQueryParams(): QueryParams | undefined {
        const { originalURLQueryString } = this

        return originalURLQueryString
            ? strToQueryParams(originalURLQueryString)
            : undefined
    }

    @computed private get originalURLSelectedEntities(): string[] {
        const originalEntityQueryParam = this.originalURLQueryParams?.[
            "country"
        ]

        const entityQueryParamExists =
            originalEntityQueryParam != undefined &&
            !isEmpty(originalEntityQueryParam)

        return entityQueryParamExists
            ? EntityUrlBuilder.queryParamToEntityNames(originalEntityQueryParam)
            : []
    }

    @computed private get entitiesInGlobalEntitySelection() {
        return GlobalEntityControl.singleton().selectedEntityNames
    }

    @computed private get updatedEntityQueryParam(): string {
        const newEntityList = union(
            this.originalURLSelectedEntities,
            this.entitiesInGlobalEntitySelection
        )

        return EntityUrlBuilder.entityNamesToEncodedQueryParam(newEntityList)
    }

    @computed private get updatedURLParams(): QueryParams {
        const { originalURLQueryParams, updatedEntityQueryParam } = this

        return {
            ...originalURLQueryParams,
            ...(!isEmpty(updatedEntityQueryParam) && {
                country: updatedEntityQueryParam,
            }),
        }
    }

    @computed private get updatedURL() {
        return this.originalURLPath + queryParamsToStr(this.updatedURLParams)
    }

    render() {
        return (
            <a
                dangerouslySetInnerHTML={{ __html: this.props.innerHTML ?? "" }}
                {...this.props.originalAnchorAttributes}
                href={this.updatedURL}
            />
        )
    }
}

export const renderProminentLink = () => {
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
                />
            )

            ReactDOM.render(rendered, el)
        })
}
