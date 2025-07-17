#!/usr/bin/env tsx
// This is a simple script to add incoming foreign keys to database documentation files.

import { dataSource } from "../../db/dataSource.js"
import * as fs from "fs"
import * as path from "path"
import * as yaml from "yaml"

interface ForeignKeyInfo {
    tableName: string
    columnName: string
    referencedTableName: string
    referencedColumnName: string
}

interface IncomingForeignKey {
    table: string
    column: string
}

interface TableDocumentation {
    metadata: {
        description: string
        incoming_foreign_keys?: IncomingForeignKey[]
    }
    fields: Record<string, any>
}

async function getAllForeignKeys(): Promise<ForeignKeyInfo[]> {
    const query = `
        SELECT
            TABLE_NAME as tableName,
            COLUMN_NAME as columnName,
            REFERENCED_TABLE_NAME as referencedTableName,
            REFERENCED_COLUMN_NAME as referencedColumnName
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE REFERENCED_TABLE_NAME IS NOT NULL
        AND TABLE_SCHEMA = DATABASE()
        ORDER BY REFERENCED_TABLE_NAME, TABLE_NAME, COLUMN_NAME
    `

    const results = await dataSource.query(query)
    return results as ForeignKeyInfo[]
}

function groupForeignKeysByReferencedTable(
    foreignKeys: ForeignKeyInfo[]
): Record<string, IncomingForeignKey[]> {
    const grouped: Record<string, IncomingForeignKey[]> = {}

    for (const fk of foreignKeys) {
        if (!grouped[fk.referencedTableName]) {
            grouped[fk.referencedTableName] = []
        }

        grouped[fk.referencedTableName].push({
            table: fk.tableName,
            column: fk.columnName,
        })
    }

    return grouped
}

async function updateTableDocumentation(
    tableName: string,
    incomingForeignKeys: IncomingForeignKey[]
): Promise<void> {
    const docsDir = path.join(process.cwd(), "db", "docs")
    const filePath = path.join(docsDir, `${tableName}.yml`)

    if (!fs.existsSync(filePath)) {
        console.log(
            `Warning: Documentation file not found for table '${tableName}', skipping`
        )
        return
    }

    try {
        const fileContent = fs.readFileSync(filePath, "utf8")
        const doc = yaml.parse(fileContent) as TableDocumentation

        if (!doc.metadata) {
            console.log(
                `Warning: No metadata section found in ${tableName}.yml, skipping`
            )
            return
        }

        // Add or update the incoming_foreign_keys section
        if (incomingForeignKeys.length > 0) {
            doc.metadata.incoming_foreign_keys = incomingForeignKeys
            console.log(
                `Added ${incomingForeignKeys.length} incoming foreign keys to ${tableName}.yml`
            )
        } else {
            // Remove the section if it exists but has no incoming foreign keys
            if (doc.metadata.incoming_foreign_keys) {
                delete doc.metadata.incoming_foreign_keys
                console.log(
                    `Removed empty incoming foreign keys section from ${tableName}.yml`
                )
            }
        }

        // Write the updated YAML back to file
        const updatedContent = yaml.stringify(doc, {
            indent: 4,
            lineWidth: 0,
            minContentWidth: 0,
            nullStr: "null",
        })

        fs.writeFileSync(filePath, updatedContent, "utf8")
    } catch (error) {
        console.error(
            `Error updating documentation for table '${tableName}':`,
            error
        )
    }
}

async function main() {
    console.log(
        "Starting to add incoming foreign keys to database documentation..."
    )

    try {
        // Initialize the database connection
        await dataSource.initialize()

        // Get all foreign key relationships
        console.log("Querying database for foreign key relationships...")
        const foreignKeys = await getAllForeignKeys()
        console.log(`Found ${foreignKeys.length} foreign key relationships`)

        // Group by referenced table
        const groupedForeignKeys =
            groupForeignKeysByReferencedTable(foreignKeys)

        // Get list of all tables that have documentation
        const docsDir = path.join(process.cwd(), "db", "docs")
        const docFiles = fs
            .readdirSync(docsDir)
            .filter((file) => file.endsWith(".yml"))
        const documentedTables = docFiles.map((file) =>
            file.replace(".yml", "")
        )

        console.log(`Found ${documentedTables.length} documented tables`)

        // Update each documented table
        for (const tableName of documentedTables) {
            const incomingForeignKeys = groupedForeignKeys[tableName] || []
            await updateTableDocumentation(tableName, incomingForeignKeys)
        }

        console.log("Successfully updated all table documentation files")
    } catch (error) {
        console.error("Error:", error)
        process.exit(1)
    } finally {
        // Close the database connection
        if (dataSource.isInitialized) {
            await dataSource.destroy()
        }
    }
}

main().catch((error) => {
    console.error("Unexpected error:", error)
    process.exit(1)
})
