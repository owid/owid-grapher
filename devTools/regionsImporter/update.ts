import { readFile, writeFile } from 'fs/promises'
import { execFileSync } from 'child_process'
import { createHash } from 'crypto'
import { parse } from 'papaparse'
import fetch from 'node-fetch'
import _ from 'lodash'

const ETL_REGIONS_URL = "https://catalog-staging.ourworldindata.org/grapher/regions/2023-01-01/regions/regions.csv",
      GRAPHER_ROOT = __dirname.replace(/\/(itsJustJavascript\/)?devTools.*/, ""),
      GRAPHER_REGIONS_PATH = `${GRAPHER_ROOT}/packages/@ourworldindata/utils/src/regions.json`,
      ADDITIONAL_CONTINENT_MEMBERS = {
        Africa: [ 'OWID_SML', 'OWID_ZAN' ],
        Asia: [ 'OWID_ABK', 'OWID_AKD', 'OWID_NAG', 'OWID_CYN', 'OWID_SOS' ],
        Europe: [ 'OWID_CIS', 'SJM', 'OWID_TRS' ],
      }




async function main(){
  // fetch csv and js-ify non-string fields
  console.log(`Fetching ${ETL_REGIONS_URL}`)
  let response = await fetch(ETL_REGIONS_URL),
      {data, errors, meta} = parse(await response.text(), {
        header:true,
        transform: (val, col) => {
          switch (col){
            case 'is_mappable':
            case 'omit_country_page':
              return val==='True'

            case 'members':
              return val ? JSON.parse(val.replace(/'/g, '"')) : undefined

            default:
              return val
          }
        }
      })

  let entities = data.map((row:any) => {
    // drop unused/redundant attrs
    let entity = _.pickBy(row, val => !!val)
    if (entity.short_name===entity.name) delete entity.short_name
    if (entity.region_type==='country'){
      delete entity.region_type
    }else{
      delete entity.is_mappable
    }

    // add back countries removed from the ETL's continents list
    if (entity.region_type==='continent'){
      entity.members = [...entity.members, ..._.get(ADDITIONAL_CONTINENT_MEMBERS, entity.name, [])]
    }

    // convert keys to camelCase
    return _.mapKeys(entity, (val, key) => _.camelCase(key))
  })

  // generate new regions.json file and report changes (if any)
  let newRegions = JSON.stringify(entities, null, "  "),
      newHash = createHash("md5").update(newRegions).digest("hex"),
      oldHash = createHash("md5").update(await readFile(GRAPHER_REGIONS_PATH)).digest("hex")

  await writeFile(GRAPHER_REGIONS_PATH, newRegions)
  console.log(`${
    newHash === oldHash ? "No changes" : "Contents changed"
  }: ${GRAPHER_REGIONS_PATH}`)

  if (newHash!==oldHash){
    let diff = execFileSync('git', ['diff', '--color=always', GRAPHER_REGIONS_PATH])
    console.log(diff.toString())
  }
}


main()