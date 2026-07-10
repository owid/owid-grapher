Displays a short preview of content on page load with a "Show more" button
that reveals the rest inline. Any Archie block is supported inside.

```archie
[.+expandable-paragraph]
Here’s a more detailed explanation of how they determined the winner and payout:
[.list]
* $200 was placed on each of the five metals individually. So, the total amount at stake was $1,000.
* The 1980 price of each metal was taken as a baseline.
* The change in the inflation-adjusted price of each metal was compared in 1990. For example, the price of copper fell by around 24% between 1980 and 1990.
* They then multiplied the $200 for each metal by its respective price change. So, if the price of copper <i>fell</i> by 24%, Ehrlich owed $48; if it increased by 24%, Simon owed $48.
* The loss or gain for each metal was then summed up to get the total. If the total basket of metals had increased in price, Ehrlich had to pay. If it decreased, Simon had to pay.
* The $1,000 basket of metals in 1980 had dropped by $576, which is what Ehrlich owed Simon as the forfeit in the bet.
[]
[]
```

## When to use

- Keeping a long passage compact while still offering the full text inline.

## When NOT to use

- A couple of paragraphs don't need it — only reach for it when there is
  a lot to say.
- Prefer `{.expander}` when you want a distinct boxed affordance for
  large tables or technical sections.
