#!./env/bin/python3

from fontTools.ttLib import TTFont
from more_itertools import consecutive_groups
from operator import itemgetter
from os.path import basename, splitext
import sys
import re

WEIGHTS = {
    "Black": 900,
    "Heavy": 800,
    "Bold": 700,
    "Semibold": 600,
    "Medium": 500,
    "": 400,
    "Regular": 400,
    "Light": 300,
    "Thin": 200,
    "Hairline": 100,
}

def inspect_font(path):
    name = splitext(basename(path))[0]
    family = re.match(r'(.*?)(Latin)?-', name).group(1)
    weight = re.search(r'\-(.*?)(Italic)?$', name).group(1)
    italic = bool(re.search(r'Italic$', name))
    for cmap in TTFont(path)['cmap'].tables:
        if cmap.isUnicode():
            codepoints = [k for k in cmap.cmap]
            break

    return dict(
        family = re.sub(r'(?<=.)([A-Z])', r' \1', family),
        subset = 'Latin' in name,
        weight = WEIGHTS[weight],
        italic = italic,
        style = "italic" if italic else "normal",
        codepoints = codepoints,
        url = f'/fonts/{basename(path)}'
    )

def find_ranges(iterable):
    for group in consecutive_groups(sorted(iterable)):
        group = list(group)
        if len(group) == 1:
            yield 'U+%X' % group[0]
        else:
            yield 'U+%X-%X' % (group[0], group[-1])


def make_face(font, subset=None):
    css = [
        '@font-face {',
        f'font-family: "{font["family"]}";',
        f'src: url("{font["url"]}") format("woff2");',
        f'font-weight: {font["weight"]};',
        f'font-style: {font["style"]};',
        f'font-display: swap;',
        '}'
    ]

    if subset:
        css.insert(-1, f'''unicode-range: {
            ', '.join(find_ranges(set(font["codepoints"]) - set(subset["codepoints"])))
        };''')

    return "\n".join(css)

def main(woff_files):
    fonts = sorted([inspect_font(f) for f in woff_files], key=itemgetter('weight', 'italic'))
    
    lato = [f for f in fonts if f['family']=='Lato' and not f['subset']]
    lato_latin = [f for f in fonts if f['family']=='Lato' and f['subset']]
    playfair = [f for f in fonts if f['family']=='Playfair Display']

    subset_for = lambda f: [s for s in lato_latin if s['weight']==f['weight'] and s['style']==f['style']][0]
    
    faces = [
        "/* Lato: smaller, latin-only subset */",
        *[make_face(f) for f in lato_latin],
        "/* Lato: larger, full character set version */",
        *[make_face(f, subset_for(f)) for f in lato],
        "/* Playfair Display */",
        *[make_face(f) for f in playfair],
    ]
    print("\n\n".join(faces))


if __name__ == "__main__":
    main(sys.argv[1:])