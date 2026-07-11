import { Card } from "./Card.js"
import { Controls } from "./Controls.js"

/** The full interactive: inputs on top, the card below */
export function App() {
    return (
        <div className="your-life-in-data">
            <Controls />
            <Card />
        </div>
    )
}

/** Just the inputs — for embedding at the top of an article, cards elsewhere */
export function ControlsOnly() {
    return (
        <div className="your-life-in-data">
            <Controls />
        </div>
    )
}

/** Just the card — reacts to a controls variant elsewhere on the page, or to config */
export function CardOnly() {
    return (
        <div className="your-life-in-data">
            <Card />
        </div>
    )
}
