import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
} from "@material-ui/core"
import { IDataCatalogHit } from "./DataCatalogUtils.js"
import { Hit } from "instantsearch.js"

export const ChartHitsTable = ({ hits }: { hits: Hit<IDataCatalogHit>[] }) => {
    return (
        <TableContainer component={Paper}>
            <Table aria-label="data catalog results table">
                <TableHead>
                    <TableRow>
                        <TableCell>Title</TableCell>
                        <TableCell>Variant</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {hits.map((hit) => (
                        <TableRow
                            key={hit.objectID}
                            style={{ cursor: "pointer" }}
                            hover
                        >
                            <TableCell>{hit.title}</TableCell>
                            <TableCell>{hit.variantName}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    )
}
