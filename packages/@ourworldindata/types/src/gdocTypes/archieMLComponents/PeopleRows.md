A grid of `{.person}` cards, used on about pages to present team
members. Wraps an inner `[.+people]` list of people blocks.

```archie
{.people-rows}
columns: 2
[.+people]
{.person}
image: antoinette_team_page.jpeg
name: Antoinette Finnegan
title: HR Manager
url: 
[.+text]
Antoinette joined us in 2023 as our Human Resources (HR) Manager. She most recently worked in HR for a biotech spinout, and also has experience in fundraising and marketing.
[]
[.socials]
type: email
url: mailto:antoinette@ourworldindata.org
text: antoinette@ourworldindata.org
[]
{}
{.person}
image: Natalie.png
name: Natalie Reynolds-Garcia
title: Operations and Administration Officer
url: 
[.+text]
Natalie joined us in 2022 as Operations and Administration Officer. Her background is in research administration and education, having taught Spanish, French and English. She was previously the administrator for the Rees Centre at the University at Oxford.
[]
[.socials]
type: email
url: mailto:natalie@ourworldindata.org
text: natalie@ourworldindata.org
[]
{}
{.person}
image: Valerie-headshot-e1656491769502.jpg
name: Valerie Rogers Muigai, CGMA
title: Senior Finance and Operations Manager
url: 
[.+text]
Valerie joined OWID in 2021. She is a CGMA-certified management accountant with an MBA from Oxford Saïd Business School. Before joining OWID, she spent over a decade working in social enterprise and international development in East Africa.
[]
[.socials]
type: email
url: mailto:valerie@ourworldindata.org
text: valerie@ourworldindata.org
[]
{}
[]
{}
```

## When to use

- On about pages (`type: about-page`) to list team, board, or
  advisors.

## When NOT to use

- Elsewhere.

## Notes

Four columns suit compact cards; two suit cards with longer bios. Fewer
columns render on smaller screens either way.
