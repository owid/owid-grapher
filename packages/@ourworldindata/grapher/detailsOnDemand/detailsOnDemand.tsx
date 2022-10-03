import React from "react"
import { Tippy } from "../chart/Tippy.js"
import { MarkdownTextWrap } from "../text/MarkdownTextWrap.js"
import { computed, observable, ObservableMap } from "mobx"
import { observer } from "mobx-react"
import { Detail } from "../core/GrapherConstants.js"

class DetailsOnDemand {
    @observable details = new ObservableMap<
        string,
        ObservableMap<string, Detail>
    >()

    @observable getDetail(category: string, term: string): Detail | void {
        const terms = this.details.get(category)
        if (terms) {
            const detail = terms.get(term)
            return detail
        }
    }

    @observable addDetails(details: Record<string, Record<string, Detail>>) {
        const observableDetails = Object.entries(details).reduce(
            (acc, [category, terms]) => {
                acc.set(category, new ObservableMap(terms))
                return acc
            },
            new ObservableMap()
        )
        this.details = this.details.merge(observableDetails)
    }
}

// An object that can be shared throughout the codebase to make details globally accessible
export const globalDetailsOnDemand = new DetailsOnDemand()

interface DoDWrapperProps {
    category: string
    term: string
    children?: React.ReactNode
}

@observer
export class DoDWrapper extends React.Component<DoDWrapperProps> {
    constructor(props: DoDWrapperProps) {
        super(props)
    }
    @computed get category() {
        return this.props.category
    }
    @computed get term() {
        return this.props.term
    }
    @computed get detail() {
        return globalDetailsOnDemand.getDetail(this.category, this.term)
    }
    @computed get content() {
        if (this.detail) {
            return this.detail.content
        }
        return ""
    }

    @computed get title() {
        if (this.detail) {
            return this.detail.title
        }
        return this.term
    }
    render() {
        if (!this.content) return this.props.children
        return (
            <span className="interactive-tippy-wrapper">
                <Tippy
                    placement="auto"
                    className="dod-tippy-container"
                    content={
                        <div className="dod-tooltip">
                            <h3>{this.title}</h3>
                            <MarkdownTextWrap
                                text={this.content}
                                lineHeight={1.4}
                                fontSize={14}
                            />
                        </div>
                    }
                    interactive
                    hideOnClick={false}
                    arrow={false}
                >
                    <span
                        aria-label={`A definition of the term ${this.title}`}
                        tabIndex={0}
                        className="dod-term"
                    >
                        {this.props.children}
                    </span>
                </Tippy>
            </span>
        )
    }
}
