import * as React from "react"
import * as ReactDOM from "react-dom"

export class ExploreView extends React.Component {
  static bootstrap({containerNode}: {containerNode: HTMLElement}) {
    return ReactDOM.render(<ExploreView/>, containerNode)
  }

  render() {
    return <blockquote>
      “If you want to build a ship, don't drum up the men to gather wood, divide the work, and give orders.
      Instead, teach them to yearn for the vast and endless sea.”
    </blockquote>
  }
}
