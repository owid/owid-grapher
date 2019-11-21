// Experimental script to import data_values into mongodb for testing

const fs = require("fs")
const MongoClient = require("mongodb").MongoClient

const url = "mongodb://localhost:27017"

async function mongoImport() {
    const client = await MongoClient.connect(url)
    const db = client.db("owid")
    const values = db.collection("values")

    const stream = fs.createReadStream("/tmp/data_values.sql")

    let buffer = ""
    let openParen = false
    let total = 0
    let toInsert = []

    function writeMongo() {
        values.insertMany(toInsert)
        total += toInsert.length
        console.log(total)
        toInsert = []
    }

    stream
        .on("data", chunk => {
            const data = chunk.toString("utf8")
            for (let i = 0; i < data.length; i++) {
                if (data[i] === "(") {
                    openParen = true
                } else if (data[i] === ")" && openParen) {
                    openParen = false
                    const [
                        id,
                        value,
                        year,
                        entityId,
                        variableId
                    ] = buffer.split(",")
                    toInsert.push({ value, year, entityId, variableId })
                    buffer = ""

                    if (toInsert.length >= 100000) {
                        writeMongo()
                    }
                } else if (openParen) {
                    buffer += data[i]
                }
            }
        })
        .on("end", () => {
            writeMongo()
        })
}

mongoImport()
