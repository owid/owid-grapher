import * as React from "react"
import ReactDOM from "react-dom"
import { Grapher } from "site/client/Grapher"
import { observer } from "mobx-react"
import { computed } from "mobx"
import {
    strToQueryParams,
    queryParamsToStr,
    splitURLintoPathAndQueryString,
    QueryParams
} from "utils/client/url"
import { EntityUrlBuilder } from "charts/ChartUrl"
import { union, isEmpty } from "charts/Util"

export const PROMINENT_LINK_CLASSNAME = "wp-block-owid-prominent-link"

@observer
class ProminentLink extends React.Component<{
    originalURL: string
    innerHTML: string | null
}> {
    @computed get originalURLPath() {
        return splitURLintoPathAndQueryString(this.props.originalURL).path
    }

    @computed get originalURLQueryString(): string | undefined {
        return splitURLintoPathAndQueryString(this.props.originalURL)
            .queryString
    }

    @computed get originalURLQueryParams(): QueryParams | undefined {
        const { originalURLQueryString } = this

        return originalURLQueryString
            ? strToQueryParams(originalURLQueryString)
            : undefined
    }

    @computed get originalURLEntityCodes(): string[] {
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

    @computed get entitiesInGlobalEntitySelection(): string[] {
        return Grapher.globalEntitySelection.selectedEntities.map(
            entity => entity.code
        )
    }

    @computed get updatedEntityQueryParam(): string {
        const newEntityList = union(
            this.originalURLEntityCodes,
            this.entitiesInGlobalEntitySelection
        )

        return EntityUrlBuilder.entitiesToQueryParam(newEntityList)
    }

    @computed get updatedURLParams(): QueryParams {
        const { originalURLQueryParams, updatedEntityQueryParam } = this

        return {
            ...originalURLQueryParams,
            ...(!isEmpty(updatedEntityQueryParam) && {
                country: updatedEntityQueryParam
            })
        }
    }

    @computed get updatedURL() {
        return this.originalURLPath + queryParamsToStr(this.updatedURLParams)
    }

    render() {
        return (
            <a
                dangerouslySetInnerHTML={{ __html: this.props.innerHTML ?? "" }}
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

            const originalUrl = anchorTag.href
            const innerHTML = anchorTag.innerHTML

            const rendered = (
                <ProminentLink
                    originalURL={originalUrl}
                    innerHTML={innerHTML}
                />
            )

            ReactDOM.render(rendered, el)
        })
}
