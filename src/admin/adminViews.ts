// Misc non-SPA views
import {Router} from 'express'
import {expectInt, csvRow} from './serverUtil'
import * as db from '../db'
import * as filenamify from 'filenamify'

const adminViews = Router()

adminViews.get('/datasets/:datasetId.csv', async (req, res) => {
    const datasetId = expectInt(req.params.datasetId)


    const datasetName = (await db.get(`SELECT name FROM datasets WHERE id=?`, [datasetId])).name
    res.setHeader('Content-Disposition', `attachment; filename='${filenamify(datasetName)}.csv'`)

    const csvHeader = ["Entity", "Year"]

    const variables = await db.query(`SELECT name FROM variables v WHERE v.datasetId=? ORDER BY v.id ASC`, [datasetId])
    for (const variable of variables) {
        csvHeader.push(variable.name)
    }

    res.write(csvRow(csvHeader))

    const data = await db.query(`
        SELECT e.name AS entity, dv.year, dv.value FROM data_values dv
        JOIN variables v ON v.id=dv.variableId
        JOIN datasets d ON v.datasetId=d.id
        JOIN entities e ON dv.entityId=e.id
        WHERE d.id=?
        ORDER BY e.name ASC, dv.year ASC, dv.variableId ASC`, [datasetId])

    let row: string[] = []
    for (const datum of data) {
        if (datum.entity !== row[0] || datum.year !== row[1]) {
            // New row
            if (row.length)
                res.write(csvRow(row))
            row = [datum.entity, datum.year]
        }

        row.push(datum.value)
    }

    // Final row
    res.write(csvRow(row))

    res.end()
})

export default adminViews
