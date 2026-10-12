// Seeds a published test profile into the local dev DB that exercises the
// ranking blocks (ranking-cards, peer-ranking, peer-comparison). Prototype
// helper: view it at /profile/rankings-prototype/germany on the admin server.
//
// Usage: yarn tsx --tsconfig tsconfig.tsx.json devTools/profiles/seedRankingsTestProfile.ts [--delete]

import { archieToEnriched } from "@ourworldindata/gdoc-pipeline"
import * as db from "../../db/db.js"
import { GdocProfile } from "../../db/model/Gdoc/GdocProfile.js"
import { upsertGdoc } from "../../db/model/Gdoc/GdocFactory.js"
import { PostsGdocsTableName } from "@ourworldindata/types"

const GDOC_ID = "test-rankings-prototype-profile"
const SLUG = "rankings-prototype"

const grapher = (slug: string): string =>
    `https://ourworldindata.org/grapher/${slug}?country=$entityCode`

const ARCHIE = `
type: profile
title: Rankings prototype
excerpt: A test profile for the new ranking components.
authors: Our World in Data team
scope: Germany

[+body]
This is a prototype profile for $entityName that shows the new ranking components. Values are computed from the latest data at bake time.

{.ranking-cards}
title: $EntityName at a glance
subtitle: Key figures for $entityName, and how they compare
sparklines: true
change-since: 10
[.cards]
url: ${grapher("population")}&time=1800..latest
topic: Population
url: ${grapher("life-expectancy")}
topic: Health
url: ${grapher("gdp-per-capita-worldbank")}
topic: Economic growth
url: ${grapher("co2-emissions-per-capita")}
topic: Environment
sort: lowest
[]
{}

{.ranking-cards}
title: How $entityName ranks
change-since: 10
[.cards]
url: ${grapher("life-expectancy")}
topic: Health
url: ${grapher("child-mortality")}
topic: Health
sort: lowest
url: ${grapher("share-of-final-energy-consumption-from-renewable-sources")}
title: Renewables share of final energy
topic: Energy
url: ${grapher("mean-years-of-schooling-long-run")}
topic: Education
url: ${grapher("share-of-individuals-using-the-internet")}
topic: Technology
url: ${grapher("human-development-index")}
topic: Human development
[]
{}

{.heading}
text: How $entityName compares with its peers
level: 2
{}

{.peer-ranking}
url: ${grapher("life-expectancy")}
groups: Neighbours, European Union (27), Europe, High-income countries, World
{}

{.peer-comparison}
title: How $entityName compares
groups: Neighbours, European Union (27), High-income countries, World
[.indicators]
url: ${grapher("life-expectancy")}
title: Life expectancy
url: ${grapher("gdp-per-capita-worldbank")}
title: GDP per capita
url: ${grapher("co2-emissions-per-capita")}
title: CO₂ per capita
url: ${grapher("share-of-final-energy-consumption-from-renewable-sources")}
title: Renewables share of final energy
url: ${grapher("child-mortality")}
title: Child mortality
[]
{}
[]
`

async function main(): Promise<void> {
    const shouldDelete = process.argv.includes("--delete")
    await db.knexReadWriteTransaction(async (trx) => {
        if (shouldDelete) {
            await trx(PostsGdocsTableName).where({ id: GDOC_ID }).delete()
            console.log(`Deleted ${GDOC_ID}`)
            return
        }
        const gdoc = new GdocProfile(GDOC_ID)
        gdoc.content = archieToEnriched(ARCHIE, gdoc._enrichSubclassContent)
        gdoc.slug = SLUG
        gdoc.published = true
        gdoc.publishedAt = new Date()
        gdoc.createdAt = new Date()
        gdoc.updatedAt = new Date()
        await upsertGdoc(trx, gdoc)

        const parseErrors = JSON.stringify(gdoc.content.body).match(
            /"parseErrors":\[\{[^\]]*\]/g
        )
        if (parseErrors) console.warn("Parse errors:", parseErrors)
        console.log(
            `Upserted ${GDOC_ID}. View at /profile/${SLUG}/germany on the admin server.`
        )
    }, db.TransactionCloseMode.Close)
}

void main()
