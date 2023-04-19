import sys
import json
import yaml
import csv
import re
from pprint import pprint
from owid import catalog

grapher_keys = ['code','short_code','name','short_name','slug','is_historical','is_mappable','omit_country_page','region_type','aliases','members']

no_country_page = [
  'ALA', 'ANT', 'ATA', 'ATF', 'BES', 'BVT', 'CCK', 'COK',
  'CUW', 'ESH', 'GGY', 'GLP', 'HMD', 'IOT', 'MAF', 'MSR',
  'SGS', 'SHN', 'SJM', 'UMI', 'WLF'
]

mappable_countries = [
  "AFG","AGO","ALB","AND","ARE","ARG","ARM","ATF","ATG","AUS",
  "AUT","AZE","BDI","BEL","BEN","BFA","BGD","BGR","BHR","BHS",
  "BIH","BLR","BLZ","BOL","BRA","BRB","BRN","BTN","BWA","CAF",
  "CAN","CHE","CHL","CHN","CIV","CMR","COD","COG","COL","COM",
  "CPV","CRI","CUB","CYP","CZE","DEU","DJI","DMA","DNK","DOM",
  "DZA","ECU","EGY","ERI","ESH","ESP","EST","ETH","FIN","FJI",
  "FRA","FSM","GAB","GBR","GEO","GHA","GIN","GMB","GNB","GNQ",
  "GRC","GRD","GRL","GTM","GUF","GUY","HND","HRV","HTI","HUN",
  "IDN","IND","IRL","IRN","IRQ","ISL","ISR","ITA","JAM","JOR",
  "JPN","KAZ","KEN","KGZ","KHM","KIR","KNA","KOR","KWT","LAO",
  "LBN","LBR","LBY","LCA","LIE","LKA","LSO","LTU","LUX","LVA",
  "MAR","MCO","MDA","MDG","MDV","MEX","MHL","MKD","MLI","MLT",
  "MMR","MNE","MNG","MOZ","MRT","MUS","MWI","MYS","NAM","NCL",
  "NER","NGA","NIC","NLD","NOR","NPL","NRU","NZL","OMN","OWID_KOS",
  "PAK","PAN","PER","PHL","PLW","PNG","POL","PRI","PRK","PRT",
  "PRY","PSE","QAT","ROU","RUS","RWA","SAU","SDN","SEN","SGP",
  "SLB","SLE","SLV","SMR","SOM","SRB","SSD","STP","SUR","SVK",
  "SVN","SWE","SWZ","SYC","SYR","TCD","TGO","THA","TJK","TKM",
  "TLS","TON","TTO","TUN","TUR","TUV","TWN","TZA","UGA","UKR",
  "URY","USA","UZB","VCT","VEN","VNM","VUT","WSM","YEM","ZAF",
  "ZMB","ZWE"
]

legacy_slugs = {
  "CZE": "czech-republic",
  "MKD": "macedonia",
  "SWZ": "swaziland",
  "TLS": "timor",
}

def slugify(name):
  return re.sub(r'[^\w\-]', '', name.lower().replace(' ', '-'))

def main():
  with open("regions_2023-01-01/regions.yml") as yaml_file:
      entities = {e['code']:{k:v for k,v in e.items() if k in grapher_keys} for e in yaml.safe_load(yaml_file)}

      # add back some continent mappings that are commented out in regions.yml
      entities['OWID_AFR']['members'].extend(['OWID_SML','OWID_ZAN' ])
      entities['OWID_ASI']['members'].extend(['OWID_ABK','OWID_AKD','OWID_NAG','OWID_CYN','OWID_SOS' ])
      entities['OWID_EUR']['members'].extend(['OWID_CIS','SJM','OWID_TRS' ])

      for code in no_country_page:
        entities[code]['omit_country_page'] = True

      for code in mappable_countries:
        entities[code]['is_mappable'] = True

      for country in [c for c in entities.values() if 'region_type' not in c]:
        country['slug'] = legacy_slugs.get(country['code'], slugify(country['name']))

  with open('regions_2023-01-01/regions.codes.csv', mode='r') as csv_file:
      csv_reader = csv.DictReader(csv_file)
      for row in csv_reader:
        entity = entities.get(row['code'])
        if entity and row['iso_alpha2']:
          entity['short_code'] = row['iso_alpha2']


  with open('grapher-regions.json', 'w', encoding='utf-8') as f:
    json.dump(list(entities.values()), f)

  with open('grapher-regions.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, grapher_keys)
    writer.writeheader()
    writer.writerows(entities.values())

if __name__ == '__main__':
  main()