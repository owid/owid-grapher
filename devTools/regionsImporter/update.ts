import { readFile, writeFile } from 'fs/promises'
import { execFileSync } from 'child_process'
import { createHash } from 'crypto'
import { parse } from 'papaparse'
import fetch from 'node-fetch'
import _ from 'lodash'

const ETL_REGIONS_URL = "https://catalog-staging.ourworldindata.org/grapher/regions/latest/regions/regions.csv",
      GRAPHER_ROOT = __dirname.replace(/\/(itsJustJavascript\/)?devTools.*/, ""),
      GRAPHER_REGIONS_PATH = `${GRAPHER_ROOT}/packages/@ourworldindata/utils/src/regions.json`,
      ADDITIONAL_CONTINENT_MEMBERS = {
        Africa: [ 'OWID_SML', 'OWID_ZAN' ],
        Asia: [ 'OWID_ABK', 'OWID_AKD', 'OWID_NAG', 'OWID_CYN', 'OWID_SOS' ],
        Europe: [ 'OWID_CIS', 'SJM', 'OWID_TRS' ],
      },
      SEARCH_ALIASES = {
        ARE: ["UAE"],
        CZE: ["Czech Republic"],
        GBR: ["UK"],
        MKD: ["Macedonia"],
        SWZ: ["Swaziland"],
        USA: ["US", "USA"],
      }

interface Entity {
    code: string,
    short_code?: string,
    name: string,
    short_name?: string,
    slug?: string,
    region_type?: string,
    is_mappable?: boolean,
    is_historical?: boolean,
    omit_country_page?: boolean,
    variant_names?: string[],
    members?: string[],
}

function csvToJson(val:string, col:string){
  switch (col){
    case 'is_mappable':
    case 'is_historical':
    case 'omit_country_page':
      return val==='True'

    case 'members':
      // use eval since pandas produces non-json arrays using single-quoted strings
      return val ? eval(val) : undefined

    default:
      return val
  }
}

async function main(){
  // fetch csv and js-ify non-string fields
  console.log(`Fetching ${ETL_REGIONS_URL}`)
  let response = await fetch(ETL_REGIONS_URL),
      {data, errors, meta} = parse(await response.text(), {header:true, transform:csvToJson})

  // strip out empty rows and make sure entities are sorted
  data = _.sortBy(data, 'code').filter((c:any) => !!c.code)

  let entities = _.map(data as Entity[], (entity) => {
    // drop redundant attrs
    if (entity.short_name===entity.name) delete entity.short_name
    if (entity.region_type!=='country') delete entity.is_mappable

    // add back countries removed from the ETL's continents list
    if (entity.region_type==='continent'){
      entity.members = [...entity.members ?? [], ..._.get(ADDITIONAL_CONTINENT_MEMBERS, entity.name, [])]
    }

    // merge in alternate search terms
    entity.variant_names = _.get(SEARCH_ALIASES, entity.code)

    return _(entity).mapKeys((val, key) =>
      // rename keys to camelCase
      key==='omit_country_page' ? 'isUnlisted' : _.camelCase(key)
    ).pickBy(
      // omit dangling keys
      val => !!val
    ).pick(
      // give keys a consistent ordering
      "code", "shortCode", "name", "shortName", "slug", "regionType",
      "isMappable", "isHistorical", "isUnlisted", "variantNames", "members"
    ).value()
  })

  // generate new regions.json file and report changes (if any)
  let newRegions = JSON.stringify(entities, null, "  "),
      oldRegions = await readFile(GRAPHER_REGIONS_PATH).catch(e => ""),
      newHash = createHash("md5").update(newRegions).digest("hex"),
      oldHash = createHash("md5").update(oldRegions).digest("hex")

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