import { renderToStaticMarkup } from "react-dom/server"
import Tablepress from "./Tablepress.js"

export const renderTablePress = (table: string[][]) => {
    return renderToStaticMarkup(<Tablepress data={table} />)
}
