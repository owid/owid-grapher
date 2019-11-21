import db = require("db/db")
import { denormalizeLatestCountryData } from "site/server/countryProfiles"

async function main() {
    await denormalizeLatestCountryData()
    await db.end()
}

if (require.main === module) {
    main()
}
