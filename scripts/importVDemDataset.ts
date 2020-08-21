import * as XLSX from "xlsx"
import * as lodash from "lodash"
import * as fs from "fs-extra"

import { parseCSV, CSVStreamParser } from "utils/csv"
import { findUrlsInText } from "utils/string"

import * as db from "db/db"
const CODEBOOK_FILE =
    "/Users/mispy/Bulk imports/2018 V-Dem Dataset/Original/codebook_current_20180604.xlsx"
const DATA_FILE =
    "/Users/mispy/Bulk imports/2018 V-Dem Dataset/Original/Country_Year_V-Dem_Extended_CSV_v8/V-Dem-CY+Others-v8.csv"
const VARIABLE_START_COLUMN = 7

// TODO design a more long-term import api so these scripts are less fragile

async function importCodebook() {
    const codebookXLS = XLSX.readFile(CODEBOOK_FILE)
    const sheet = codebookXLS.Sheets[codebookXLS.SheetNames[0]]
    const codebookCSV = XLSX.utils.sheet_to_csv(sheet)

    const now = new Date()
    const codebookRows = await parseCSV(codebookCSV)
    const vdemVariables = codebookRows.slice(1).map(row => ({
        indicatorCode: row[0],
        indicatorName: row[1],
        shortDefinition: row[2],
        longDefinition: row[3],
        responses: row[4],
        dataRelease: row[5],
        aggregationMethod: row[6],
        variableSource: row[7].trim()
    }))

    // Need to handle these fussy subset codes separately
    const variablesByCode = lodash.keyBy(
        vdemVariables.filter(v => v.shortDefinition),
        v => v.indicatorCode
    )
    for (const v of vdemVariables) {
        const orig = variablesByCode[v.indicatorCode]
        if (orig !== v) {
            if (v.indicatorName.toLowerCase().indexOf("executive") !== -1) {
                v.indicatorCode += "_ex"
            } else if (
                v.indicatorName.toLowerCase().indexOf("legislative") !== -1
            ) {
                v.indicatorCode += "_leg"
            } else {
                throw new Error(
                    "Unknown duplicate indicator: " + v.indicatorName
                )
            }

            v.shortDefinition = orig.shortDefinition
            v.responses = orig.responses
            v.dataRelease = orig.dataRelease
            v.aggregationMethod = orig.aggregationMethod
            v.variableSource = orig.variableSource
        }
    }

    // User responsible for uploading this data
    const userId = (
        await db.get(`SELECT * FROM users WHERE fullName=?`, ["Jaiden Mispy"])
    ).id

    await db.transaction(async t => {
        const existingDataset = (
            await t.query("SELECT id FROM datasets WHERE namespace='vdem'")
        )[0]
        if (existingDataset) {
            await t.execute(
                `DELETE d FROM data_values AS d JOIN variables AS v ON d.variableId=v.id WHERE v.datasetId=?`,
                [existingDataset.id]
            )
            await t.execute(`DELETE FROM variables WHERE datasetId=?`, [
                existingDataset.id
            ])
            await t.execute(`DELETE FROM sources WHERE datasetId=?`, [
                existingDataset.id
            ])
            await t.execute(`DELETE FROM datasets WHERE id=?`, [
                existingDataset.id
            ])
        }

        const datasetRow = [
            "vdem",
            "V-Dem Dataset Version 8 - V-Dem Institute",
            "",
            false,
            now,
            now,
            now,
            userId,
            now,
            userId,
            userId
        ]
        const result = await t.query(
            "INSERT INTO datasets (namespace, name, description, isPrivate, createdAt, updatedAt, metadataEditedAt, metadataEditedByUserId, dataEditedAt, dataEditedByUserId, createdByUserId) VALUES (?)",
            [datasetRow]
        )
        const datasetId = result.insertId

        const sourceName = "V-Dem Dataset Version 8 (2018)"

        for (let i = 0; i < vdemVariables.length; i++) {
            const v = vdemVariables[i]

            let additionalInfo =
                "This variable was imported into the OWID database from Version 8 of the V-Dem Dataset. Here is the original metadata given by the V-Dem Codebook:\n\n"

            additionalInfo += `Indicator Name: ${v.indicatorName}\n\n`
            additionalInfo += `Indicator Code: ${v.indicatorCode}\n\n`
            if (v.shortDefinition)
                additionalInfo += `Short definition: ${v.shortDefinition}\n\n`
            if (v.longDefinition)
                additionalInfo += `Long definition: ${v.longDefinition}\n\n`
            if (v.responses) additionalInfo += `Responses: ${v.responses}\n\n`
            if (v.dataRelease)
                additionalInfo += `Data release: ${v.dataRelease}\n\n`
            if (v.aggregationMethod)
                additionalInfo += `Aggregation method: ${v.aggregationMethod}`

            if (v.indicatorCode === "v2exdfcbhs_rec") {
                additionalInfo +=
                    "\n| Notes: v2exdfcbhs_rec is a version of v2exdfcbhs, for v2exdfcbhs_rec the answer categories 1 and 2, 3 and 4 has been merged."
                v.indicatorName += " (rec)"
            }

            const sourceDescription = {
                dataPublishedBy: "V-Dem Institute",
                dataPublisherSource: v.variableSource,
                link: findUrlsInText(v.variableSource).join(","),
                additionalInfo: additionalInfo
            }
            const sourceRow = [
                datasetId,
                sourceName,
                now,
                now,
                JSON.stringify(sourceDescription)
            ]

            const sourceResult = await t.query(
                "INSERT INTO sources (datasetId, name, createdAt, updatedAt, description) VALUES (?)",
                [sourceRow]
            )
            const sourceId = sourceResult.insertId

            const variableRow = [
                datasetId,
                sourceId,
                i,
                v.indicatorName,
                v.indicatorCode,
                v.shortDefinition,
                now,
                now,
                JSON.stringify(v),
                "",
                "",
                "",
                "{}"
            ]
            await t.query(
                "INSERT INTO variables (datasetId, sourceId, columnOrder, name, code, description, createdAt, updatedAt, originalMetadata, unit, coverage, timespan, display) VALUES (?)",
                [variableRow]
            )
        }
    })
}

async function importData() {
    const input = fs.createReadStream(DATA_FILE, "utf8")

    // Calculated from running first column through country standardizer
    // omitting "Somaliland":"Somalia" because Somalia already exists in dataset
    const standardize = {
        "Ivory Coast": "Cote d'Ivoire",
        "Republic of the Congo": "Congo",
        "German Democratic Republic": "East Germany",
        "The Gambia": "Gambia",
        "Burma/Myanmar": "Myanmar",
        "Papal States": "Vatican",
        "São Tomé and Príncipe": "Sao Tome and Principe",
        "Timor-Leste": "Timor",
        "United States of America": "United States",
        "Democratic Republic of Vietnam": "Vietnam",
        Würtemberg: "Wurtemberg"
    } as { [key: string]: string | undefined }

    const entitiesUniq = [
        "Afghanistan",
        "Angola",
        "Albania",
        "United Arab Emirates",
        "Argentina",
        "Armenia",
        "Australia",
        "Austria",
        "Azerbaijan",
        "Burundi",
        "Baden",
        "Belgium",
        "Benin",
        "Burkina Faso",
        "Bangladesh",
        "Bulgaria",
        "Bahrain",
        "Bosnia and Herzegovina",
        "Belarus",
        "Bolivia",
        "Brazil",
        "Barbados",
        "Brunswick",
        "Bhutan",
        "Bavaria",
        "Botswana",
        "Central African Republic",
        "Canada",
        "Switzerland",
        "Chile",
        "China",
        "Cote d'Ivoire",
        "Cameroon",
        "Democratic Republic of Congo",
        "Congo",
        "Colombia",
        "Comoros",
        "Cape Verde",
        "Costa Rica",
        "Cuba",
        "Cyprus",
        "Czech Republic",
        "East Germany",
        "Germany",
        "Djibouti",
        "Denmark",
        "Dominican Republic",
        "Algeria",
        "Ecuador",
        "Egypt",
        "Eritrea",
        "Spain",
        "Estonia",
        "Ethiopia",
        "Finland",
        "Fiji",
        "France",
        "Gabon",
        "United Kingdom",
        "Georgia",
        "Ghana",
        "Guinea",
        "Gambia",
        "Guinea-Bissau",
        "Equatorial Guinea",
        "Greece",
        "Guatemala",
        "Guyana",
        "Hesse-Darmstadt",
        "Hong Kong",
        "Hesse-Kassel",
        "Honduras",
        "Hamburg",
        "Croatia",
        "Haiti",
        "Hungary",
        "Hanover",
        "Indonesia",
        "India",
        "Ireland",
        "Iran",
        "Iraq",
        "Iceland",
        "Israel",
        "Italy",
        "Jamaica",
        "Jordan",
        "Japan",
        "Kazakhstan",
        "Kenya",
        "Kyrgyzstan",
        "Cambodia",
        "South Korea",
        "Kuwait",
        "Laos",
        "Lebanon",
        "Liberia",
        "Libya",
        "Sri Lanka",
        "Lesotho",
        "Lithuania",
        "Luxembourg",
        "Latvia",
        "Morocco",
        "Mecklenburg Schwerin",
        "Moldova",
        "Madagascar",
        "Modena",
        "Maldives",
        "Mexico",
        "Macedonia",
        "Mali",
        "Myanmar",
        "Montenegro",
        "Mongolia",
        "Mozambique",
        "Mauritania",
        "Mauritius",
        "Malawi",
        "Malaysia",
        "Namibia",
        "Niger",
        "Nigeria",
        "Nicaragua",
        "Netherlands",
        "Norway",
        "Nepal",
        "Nassau",
        "New Zealand",
        "Oldenburg",
        "Oman",
        "Pakistan",
        "Panama",
        "Peru",
        "Philippines",
        "Papua New Guinea",
        "Poland",
        "Vatican",
        "North Korea",
        "Parma",
        "Portugal",
        "Paraguay",
        "Palestine/British Mandate",
        "Palestine/West Bank",
        "Palestine/Gaza",
        "Qatar",
        "Romania",
        "Russia",
        "Rwanda",
        "Saudi Arabia",
        "Saxe-Weimar-Eisenach",
        "Sudan",
        "Senegal",
        "Singapore",
        "Solomon Islands",
        "Sierra Leone",
        "El Salvador",
        "Somalia",
        "Somaliland",
        "Piedmont-Sardinia",
        "Serbia",
        "South Sudan",
        "Sao Tome and Principe",
        "Suriname",
        "Slovakia",
        "Slovenia",
        "Sweden",
        "Swaziland",
        "Saxony",
        "Seychelles",
        "Syria",
        "Chad",
        "Togo",
        "Thailand",
        "Tajikistan",
        "Turkmenistan",
        "Timor",
        "Tuscany",
        "Trinidad and Tobago",
        "Tunisia",
        "Turkey",
        "Taiwan",
        "Two Sicilies",
        "Tanzania",
        "Uganda",
        "Ukraine",
        "Uruguay",
        "United States",
        "Uzbekistan",
        "Republic of Vietnam",
        "Venezuela",
        "Vietnam",
        "Vanuatu",
        "Wurtemberg",
        "Kosovo",
        "Yemen",
        "South Yemen",
        "South Africa",
        "Zambia",
        "Zimbabwe",
        "Zanzibar"
    ]

    await db.transaction(async t => {
        await t.execute(
            `DELETE dv FROM data_values dv JOIN variables v ON dv.variableId=v.id JOIN datasets d ON v.datasetId=d.id WHERE d.namespace='vdem'`
        )

        const now = new Date()
        // Insert any new entities into the db
        const importEntityRows = entitiesUniq.map(e => [e, false, now, now, ""])
        await t.execute(
            `INSERT IGNORE entities (name, validated, createdAt, updatedAt, displayName) VALUES ?`,
            [importEntityRows]
        )

        // Map entities to entityIds
        const entityRows = await t.query(
            `SELECT id, name FROM entities WHERE name IN (?)`,
            [entitiesUniq]
        )
        const entityIdLookup: { [key: string]: number | undefined } = {}
        for (const e of entityRows) {
            entityIdLookup[e.name] = e.id
        }

        // Map variable codes to ids
        const variableIdLookup: { [key: string]: number | undefined } = {}
        const variableRows = await t.query(
            `SELECT v.code, v.id FROM variables v JOIN datasets d ON d.id=v.datasetId WHERE d.namespace='vdem'`
        )
        for (const v of variableRows) {
            variableIdLookup[v.code] = v.id
        }

        let variableIds: (number | undefined)[] = []
        let valueRows: any[][] = []
        let insertCounter = 0

        async function insertRows() {
            insertCounter += valueRows.length
            console.log(insertCounter)
            await t.execute(
                `INSERT INTO data_values (value, year, entityId, variableId) VALUES ?`,
                [valueRows]
            )
            valueRows = []
        }

        const csv = new CSVStreamParser(input)

        let row = await csv.nextRow()
        while (row !== undefined) {
            if (!variableIds.length) {
                // First row, map column names to variable ids
                variableIds = row.map((v, i) => {
                    const id = variableIdLookup[v]
                    if (!id && i >= VARIABLE_START_COLUMN)
                        console.log(`Unmatched column: ${v}`)
                    return id
                })
            } else {
                const vdemCountryName = row[0]
                const entity = standardize[vdemCountryName] || vdemCountryName
                const entityId = entityIdLookup[entity]
                if (!entityId)
                    throw new Error(`Unable to find entity ${entity}`)
                const year = row[3]

                for (let i = VARIABLE_START_COLUMN; i < row.length; i++) {
                    const variableId = variableIds[i]
                    if (!variableId || row[i] === "") continue

                    valueRows.push([
                        row[i],
                        parseInt(year),
                        entityId,
                        variableId
                    ])
                }
            }

            if (valueRows.length > 10000) {
                await insertRows()
            }

            row = await csv.nextRow()
        }

        // Final values
        if (valueRows.length) await insertRows()

        // Delete variables from the codebook with no data
        await t.execute(
            "delete v from variables v left join data_values dv on dv.variableId=v.id join datasets d on d.id=v.datasetId where d.namespace='vdem' and dv.id IS NULL;"
        )
    })
}

async function main() {
    await db.connect()
    try {
        //    await importCodebook()
        await importData()
    } finally {
        await db.end()
    }
}

main()
