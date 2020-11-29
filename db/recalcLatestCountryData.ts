// I have not run this script in a long while but have ran it in the past. It's supposed
// to populate the old country profiles cache (which speeds up baking of the country profiles). I think we can keep it?

import * as db from "db/db"
import { denormalizeLatestCountryData } from "site/countryProfiles"

async function main() {
    await denormalizeLatestCountryData()
    await db.end()
}

if (require.main === module) {
    main()
}
