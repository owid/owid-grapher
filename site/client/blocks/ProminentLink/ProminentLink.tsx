import * as React from "react"
import ReactDOM from "react-dom"
import { GrapherPageUtils } from "site/client/GrapherPageUtils"
import { observer } from "mobx-react"
import { computed } from "mobx"
import {
    strToQueryParams,
    queryParamsToStr,
    splitURLintoPathAndQueryString,
    QueryParams
} from "utils/client/url"
import { union, isEmpty, getAttributesOfHTMLElement } from "charts/utils/Util"
import { EntityUrlBuilder } from "charts/core/EntityUrlBuilder"

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

    @computed private get originalURLEntityCodes(): string[] {
        const originalEntityQueryParam = this.originalURLQueryParams?.[
            "country"
        ]

        const entityQueryParamExists =
            originalEntityQueryParam != undefined &&
            !isEmpty(originalEntityQueryParam)

        return entityQueryParamExists
            ? EntityUrlBuilder.queryParamToEntities(originalEntityQueryParam!)
            : []
    }

    @computed private get entitiesInGlobalEntitySelection(): string[] {
        return GrapherPageUtils.globalEntitySelection.selectedEntities.map(
            entity => entity.code
        )
    }

    @computed private get updatedEntityQueryParam(): string {
        const newEntityList = union(
            this.originalURLEntityCodes,
            this.entitiesInGlobalEntitySelection
        )

        return EntityUrlBuilder.entitiesToQueryParam(newEntityList)
    }

    @computed private get updatedURLParams(): QueryParams {
        const { originalURLQueryParams, updatedEntityQueryParam } = this

        return {
            ...originalURLQueryParams,
            ...(!isEmpty(updatedEntityQueryParam) && {
                country: updatedEntityQueryParam
            })
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
        .forEach(el => {
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
