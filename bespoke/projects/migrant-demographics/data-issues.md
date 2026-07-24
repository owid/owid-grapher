# Data issues: migrant-demographics.json

Anomalies found in
`https://owid-public.owid.io/bespoke/migrant-demographics/migrant-demographics.json`
(UN DESA International Migrant Stock 2020) while building this viz, with how
the code currently handles them. Numbers refer to the file as of 2026-07-24.

## 1. 34 small territories have no total-population data

`pm`/`pf` are all zeros in every year for 34 territories: Andorra, Monaco,
Liechtenstein, San Marino, Vatican, Gibraltar, Faroe Islands, Isle of Man,
Greenland, Bermuda, Saint Pierre and Miquelon, Saint Helena, Anguilla,
Bonaire Sint Eustatius and Saba, British Virgin Islands, Cayman Islands,
Dominica, Montserrat, Saint Barthélemy, Saint Kitts and Nevis, Saint Martin
(French part), Sint Maarten (Dutch part), Turks and Caicos Islands, Falkland
Islands, American Samoa, Cook Islands, Marshall Islands, Nauru, Niue,
Northern Mariana Islands, Palau, Tokelau, Tuvalu, and Wallis and Futuna.

This explains all 6,390 band-level cells where the migrant stock exceeds the
total population — every one of them belongs to a zero-population territory.
For entities that do have population data, migrant totals never exceed the
population in any year/sex.

- **Viz impact**: the migrant pyramid itself is fine, but "Compare with
  native-born" draws the native-born outline glued to the zero axis, which
  falsely reads as "no native-born residents".
- **Current handling**: native-born values are clamped at zero and shares
  guard against division by zero — i.e. the wrong outline renders without
  crashing. Not properly addressed.
- **Recommended fix**: disable the compare checkbox (with a tooltip) when
  the native-born total is zero; upstream, write `pm`/`pf` as absent rather
  than zero so missing data is explicit.

## 2. Six entities have zero migrant stock in every year

Saint Helena, China (Taiwan), Holy See (Vatican), Bonaire Sint Eustatius and
Saba, Saint Barthélemy, and Saint Martin (French part). Taiwan in particular
is a UN-reporting artifact, not a real zero.

- **Viz impact**: an empty pyramid with the subtitle "The age and sex
  profile of the 0 people living in Taiwan …".
- **Current handling**: none.
- **Recommended fix**: show the no-data state for all-zero selections (or
  drop these entities upstream).

## 3. "Latin America and the Caribbean" appears twice

Once as the SDG grouping (code 1830) and once as the UN "major area" (code
904, all-caps `LATIN AMERICA AND THE CARIBBEAN` in the file). Their data is
byte-identical.

- **Current handling**: entities are deduplicated by display name — the
  first occurrence wins, the duplicate is skipped with a `console.warn`.
- **Recommended fix**: drop one of the two upstream.

## 4. UN entity naming diverges from OWID names

About 30 country names differ from the OWID region names ("Viet Nam",
"Russian Federation", "China, Taiwan Province of China", …), and the five
continent-level "major areas" are all-caps ("WORLD", "AFRICA", "ASIA",
"EUROPE", "OCEANIA", "NORTHERN AMERICA").

- **Current handling**: addressed — `entityNames.ts` maps the divergent
  names to OWID region names (each verified against `regions.json`) and
  title-cases the all-caps aggregates. This also makes geolocation (which
  reports OWID names) work.

## 5. Population precision is nominal (minor)

`meta.note` says `pm`/`pf` are "thousands scaled to persons", but the values
are not multiples of 1,000 — they are WPP interpolations carried at person
resolution. No practical impact; just don't read person-level precision into
the population figures.
