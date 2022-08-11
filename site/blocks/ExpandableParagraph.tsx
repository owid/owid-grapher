import classnames from "classnames"
import React from "react"
import ReactDOM from "react-dom"

export class ExpandableParagraph extends React.Component<
    | {
          children: React.ReactNode
          dangerouslySetInnerHTML?: undefined
      }
    | {
          children?: undefined
          dangerouslySetInnerHTML: {
              __html: string
          }
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
                    // Either pass children or dangerouslySetInnerHTML
                    {...this.props}
                />
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
        const innerHTML = eP.innerHTML
        ReactDOM.hydrate(
            <ExpandableParagraph
                dangerouslySetInnerHTML={{ __html: innerHTML }}
            />,
            eP.parentElement
        )
    })
}
