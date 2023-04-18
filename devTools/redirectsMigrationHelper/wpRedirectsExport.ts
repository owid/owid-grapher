import { writeFile } from "fs/promises"
import { singleton } from "../../db/wpdb.js"

import Papa from "papaparse"

async function fetchWpRedirectsAndWriteCsvFile() {
    try {
        const sql = `-- sql
            SELECT
                id,
                url,
                action_data,
                action_code
            FROM
                wordpress.wp_redirection_items
            WHERE
                status = 'enabled'
            `
        const result = await singleton.query(sql)
        const csvContent = Papa.unparse(result)
        await writeFile("wp-redirects.csv", csvContent)
    } finally {
        await singleton.end()
    }
}

fetchWpRedirectsAndWriteCsvFile()
