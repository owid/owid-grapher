// I have not run this script in a long while but have ran it in the past. It's supposed
// to populate the old country profiles cache (which speeds up baking of the country profiles). I think we can keep it?

import * as db from "../db/db"
import { denormalizeLatestCountryData } from "../baker/countryProfiles"

const main = async () => {
    await denormalizeLatestCountryData()
    await db.closeTypeOrmAndKnexConnections()
}

if (require.main === module) main()
