#!./env/bin/python3
"""
This script emits CSS @font-face definitons for Playfair and Lato (along with their *Latin subsets).
The arguments should be a list of .woff2 files for all the weights & styles of those families to be included.

The filenames are parsed to infer weight and normal/italic style information. A member of each family and its Latin
counterpart are inspected more deeply using the fontTools module to extract character-map IDs. Since the Latin version
is a minimal subset of the character library (to keep its size small), we need to be able to fall back to the full
version when missing a glyph but want to ensure it's only loaded when necessary.

Even though the full version of the font contains all the characters in *Latin (and more), we define its `unicode-range`
to exclude all of the characters in the Latin subset, meaning it should only be loaded on pages where a rare character
(greek, cyrillic, exotic currencies or diacriticals, etc.) occurs — and ideally only in one or two weights even then.
"""
from fontTools.ttLib import TTFont
from more_itertools import consecutive_groups
from operator import itemgetter
from os.path import basename, splitext
from base64 import b64encode
import sys
import re

WEIGHTS = {
    "Black": 900,
    "ExtraBold": 800,
    "Heavy": 800,
    "Bold": 700,
    "Semibold": 600,
    "SemiBold": 600,
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
        ps_name = name.replace("Latin", ""),
        family = re.sub(r'(?<=.)([A-Z])', r' \1', family),
        subset = 'Latin' in name,
        weight = WEIGHTS[weight],
        italic = italic,
        style = "italic" if italic else "normal",
        codepoints = codepoints,
        url = f'/fonts/{basename(path)}',
        path = path,
    )

def find_ranges(iterable):
    for group in consecutive_groups(sorted(iterable)):
        group = list(group)
        if len(group) == 1:
            yield 'U+%X' % group[0]
        else:
            yield 'U+%X-%X' % (group[0], group[-1])


def make_face(font, subset=None, singleton=False):
    family = font["ps_name" if singleton else "family"]
    css = [
        '@font-face {',
        f'font-family: "{family}";',
        f'src: url("{font["url"]}") format("woff2");',
    ]

    if not singleton:
        css.extend([
            f'font-weight: {font["weight"]};',
            f'font-style: {font["style"]};',
        ])

    if subset:
        css.append(f'''unicode-range: {
            ', '.join(find_ranges(set(font["codepoints"]) - set(subset["codepoints"])))
        };''')

    css.extend([
        f'font-display: swap;',
        "}",
    ])

    return "\n".join(css)

def main_stylesheet(woff_files):
    fonts = sorted([inspect_font(f) for f in woff_files], key=itemgetter('weight', 'italic'))
    lato = [f for f in fonts if f['family']=='Lato' and not f['subset']]
    lato_latin = [f for f in fonts if f['family']=='Lato' and f['subset']]
    playfair = [f for f in fonts if f['family']=='Playfair Display' and not f['subset']]
    playfair_latin = [f for f in fonts if f['family']=='Playfair Display' and f['subset']]

    subset_for = lambda f: [s for s in fonts if s['subset'] and s['family']==f['family'] and s['weight']==f['weight'] and s['style']==f['style']][0]

    faces = [
        "/* Lato: smaller, latin-only subset */",
        *[make_face(f) for f in lato_latin],
        *[make_face(f, singleton=True) for f in lato_latin],
        "/* Lato: larger, full character set version */",
        *[make_face(f, subset_for(f)) for f in lato],
        *[make_face(f, subset_for(f), singleton=True) for f in lato],
        "/* Playfair Display: smaller, latin-only subset */",
        *[make_face(f) for f in playfair_latin],
        *[make_face(f, singleton=True) for f in playfair_latin],
        "/* Playfair Display: larger, full character set version */",
        *[make_face(f, subset_for(f)) for f in playfair],
        *[make_face(f, subset_for(f), singleton=True) for f in playfair],

    ]
    print("\n\n".join(faces))

def make_embedded_face(font):
    font_data = open(font['path'], 'rb').read()
    font_uri = 'data:font/woff2;base64,' + b64encode(font_data).decode('utf-8')
    family = font['family']
    weight = font['weight']
    style = font['style']

    css = [
        '@font-face {',
        'font-display: block;',
        f'font-family: "{family}";',
        f'font-weight: {weight};',
        f'font-style: {style};',
        f'src: url({font_uri}) format("woff2");',
        "}",
    ]
    return " ".join(css)

def embedded_stylesheet(woff_files):
    font_info = [inspect_font(f) for f in woff_files]

    # include just the fonts known to be used in static chart exports
    embeddable_fonts =[
        'Lato-Regular',
        'Lato-Italic',
        'Lato-Bold',
        'PlayfairDisplay-SemiBold',
    ]

    # use the latin subsets to keep the size down
    faces = [make_embedded_face(f) for f in font_info if f['subset'] and f['ps_name'] in embeddable_fonts]
    print("\n".join(faces))

if __name__ == "__main__":
    args = sys.argv[1:]
    if '--embed' in args[:1]:
        embedded_stylesheet(args[1:])
    elif args:
        main_stylesheet(args)
    else:
        print("Usage: make-faces.py [--embed] woff2-files...")

