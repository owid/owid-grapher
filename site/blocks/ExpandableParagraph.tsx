import classnames from "classnames"
import React from "react"
import ReactDOM from "react-dom"

export class ExpandableParagraph extends React.Component<
    {
        children?: React.ReactNode
    },
    {
        isExpanded: boolean
    }
> {
    state = {
        isExpanded: false,
    }

    render() {
        const { isExpanded } = this.state
        return (
            <>
                <div
                    className={classnames("expandable-paragraph", {
                        "expandable-paragraph--is-expanded": isExpanded,
                    })}
                >
                    {this.props.children}
                </div>
                {!isExpanded && (
                    <button
                        className="expandable-paragraph__expand-button"
                        onClick={() =>
                            this.setState({
                                isExpanded: true,
                            })
                        }
                    >
                        Continue reading
                    </button>
                )}
            </>
        )
    }
}

export const hydrateExpandableParagraphs = () => {
    const expandableParagraphs = document.querySelectorAll(
        ".expandable-paragraph"
    )

    expandableParagraphs.forEach((eP) => {
        const lines = [...eP.querySelectorAll("p")].map((line, i) => (
            <p key={i}>{line.textContent}</p>
        ))

        ReactDOM.hydrate(
            <ExpandableParagraph>{lines}</ExpandableParagraph>,
            eP.parentElement
        )
    })
}
