/* eslint-disable react-refresh/only-export-components */
import * as _ from "lodash-es"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { migrateSelectedEntityNamesParam } from "@ourworldindata/grapher"
import { Url } from "@ourworldindata/utils"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { Component } from "react"

export const PROMINENT_LINK_CLASSNAME = "wp-block-owid-prominent-link"

export enum ProminentLinkStyles {
    thin = "is-style-thin",
    default = "is-style-default",
}

export const WITH_IMAGE = "with-image"

interface ProminentLinkProps {
    href: string
    style: string | null
    title: string | null
    content?: string | null
    image?: string | null
}

@observer
export class ProminentLink extends Component<ProminentLinkProps> {
    constructor(props: ProminentLinkProps) {
        super(props)
        makeObservable(this)
    }

    @computed get url(): Url {
        return migrateSelectedEntityNamesParam(Url.fromURL(this.props.href))
    }

    @computed private get style(): string {
        return this.props.style || ProminentLinkStyles.default
    }

    override render() {
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
            return this.props.content?.trim() ? (
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
                        {renderContent()}
                    </div>
                </>
            )
        }

        const renderDefaultStyle = () => {
            return (
                <>
                    {this.props.title ? (
                        <h3 className="title">
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

        return (
            <div
                className={classes.join(" ")}
                data-style={this.style}
                data-title={this.props.title}
            >
                <a href={this.url.fullUrl}>
                    {this.style === ProminentLinkStyles.thin
                        ? renderThinStyle()
                        : renderDefaultStyle()}
                </a>
            </div>
        )
    }
}
