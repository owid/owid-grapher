import { CovidExplorerTable } from "charts/covidDataExplorer/CovidExplorerTable"
import { csvParse } from "d3-dsv"

const sampleCsv = `population,iso_code,location,continent,date,total_cases,new_cases,total_deaths,new_deaths,total_cases_per_million,new_cases_per_million,total_deaths_per_million,new_deaths_per_million,total_tests,new_tests,total_tests_per_thousand,new_tests_per_thousand,tests_units
1000,ABW,Aruba,North America,2020-03-13,2,2,0,0,18.733,18.733,0.0,0.0,,,,,
1000,ABW,Aruba,North America,2020-03-20,4,2,0,0,37.465,18.733,0.0,0.0,,,,,
1000,ABW,Aruba,North America,2020-03-24,12,8,0,0,112.395,74.93,0.0,0.0,,,,,
1000,ABW,Aruba,North America,2020-03-25,17,5,0,0,159.227,46.831,0.0,0.0,,,,,
2000,USA,United States,North America,2020-05-05,1180634,22593,68934,1252,3566.842,68.256,208.258,3.782,7544328.0,258954.0,22.792,0.782,inconsistent units (COVID Tracking Project)
2000,USA,United States,North America,2020-05-06,1204475,23841,71078,2144,3638.868,72.027,214.735,6.477,,,,,
3000,,World,,2020-05-01,3215927,84440,232869,5534,412.573,10.833,29.875,0.71,,,,,
3000,,World,,2020-05-02,3308891,92964,238707,5838,424.5,11.926,30.624,0.749,,,,,
3000,,World,,2020-05-03,3389459,80568,243476,4769,434.836,10.336,31.236,0.612,,,,,
3000,,World,,2020-05-04,3467502,78043,246999,3523,444.848,10.012,31.688,0.452,,,,,
3000,,World,,2020-05-05,3544168,76666,250977,3978,454.684,9.836,32.198,0.51,,,,,
3000,,World,,2020-05-06,3623803,79635,256880,5903,464.9,10.216,32.955,0.757,,,,,`

export const covidSampleRows = (csvParse(sampleCsv) as any).map(CovidExplorerTable.parseCovidRow)