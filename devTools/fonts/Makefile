VENV := .env
PYTHON := $(VENV)/bin/python3
PIP := $(VENV)/bin/pip3
SUBSET := $(VENV)/bin/pyftsubset
OXFMT := node ../../node_modules/.bin/oxfmt
.PHONY: all install report test clean

default: all
BUILD_DIR := $(VENV)/build
FONTS_DIR := ../../public/fonts
FONTS_CSS := ../../public/fonts.css
FACES = $(BUILD_DIR)/fonts.css
EMBEDS = $(BUILD_DIR)/embedded.css

LATO_WOFFS = $(wildcard $(LATO)/Lato-*.woff2)
LATO_LATIN_WOFFS = $(subst Lato-,LatoLatin-,$(LATO_WOFFS))
PLAYFAIR_WOFFS = $(patsubst %.ttf,%.woff2,$(wildcard $(PLAYFAIR)/*.ttf))
PLAYFAIR_LATIN_WOFFS = $(subst PlayfairDisplay-,PlayfairDisplayLatin-,$(PLAYFAIR_WOFFS))
FONTS = $(LATO_WOFFS) $(LATO_LATIN_WOFFS) $(PLAYFAIR_WOFFS) $(PLAYFAIR_LATIN_WOFFS)

# This is the range used by Google Fonts for its minimal version of Lato, with super/subscripts added
# since they're common in OWID articles. Run `make report` to see which characters are included in
# LatoLatin and which will fall back to Lato
LATIN_RANGE := U+0,U+20-7E,U+A0-FF,U+104-107,U+118-119,U+131,U+141-144,U+152-153,U+15A-15B,U+160-161,U+178-17E,U+192,U+2C6-2C7,U+2C9,U+2D8-2DD,U+3C0,U+2002-200D,U+2013-2014,U+2018-201A,U+201C-201E,U+2020-2022,U+2026,U+202F-2030,U+2039-203A,U+2044,U+205F,U+2070-2071,U+2074-2079,U+2080-2089,U+20AC,U+2122,U+2126,U+2190-2199,U+2202,U+220F,U+2211-2212,U+221A,U+221E,U+222B,U+2248,U+2260,U+2264-2265,U+25CA,U+FB00-FB04,U+FEFF
OT_FEATURES := subs,sups,smcp,c2sc,lnum,onum,kern,calt,liga

LATO := $(BUILD_DIR)/lato
LATO_URL := https://www.latofonts.com/download/lato2oflweb-zip
$(LATO).zip:
	curl -# $(LATO_URL) -o $@
$(LATO): $(LATO).zip
	unzip -jo $< -d $@ '*/*/*/Lato-*.woff2' && touch $@/*
LatoLatin-%: Lato-%
	$(SUBSET) $< --unicodes=$(LATIN_RANGE) --flavor=woff2 --layout-features="*" --name-IDs="*" --output-file="$@"

PLAYFAIR := $(BUILD_DIR)/playfair
PLAYFAIR_URL := https://fonts.google.com/download/list?family=Playfair%20Display
$(PLAYFAIR).tsv:
	curl -sL $(PLAYFAIR_URL) | tail -n +2 | \
	jq -r '.manifest.fileRefs[] | select(.filename | contains("Variable") | not) | [.url, .filename] | @tsv' \
	> $@
$(PLAYFAIR): $(PLAYFAIR).tsv
	mkdir -p $@
	@cat $< | while IFS=$$'\t' read -r url filename; do \
		FONT="$@/$$(basename $$filename)"; \
		curl -# "$$url" -o "$$FONT"; \
		$(PYTHON) fix-numerals.py "$$FONT"; \
	done
PlayfairDisplay-%.woff2: PlayfairDisplay-%.ttf
	$(SUBSET) $< --unicodes="*" --flavor=woff2 --layout-features+=$(OT_FEATURES) --name-IDs="*" --output-file="$@"
PlayfairDisplayLatin-%.woff2: PlayfairDisplay-%.ttf
	$(SUBSET) $< --unicodes=$(LATIN_RANGE) --flavor=woff2 --layout-features+=$(OT_FEATURES) --name-IDs="*" --output-file="$@"

$(VENV):
	python3 -m venv $@
	$(PIP) install -r requirements.txt
	mkdir -p $@/build

$(FACES): $(VENV) $(FONTS)
	@$(PYTHON) make-faces.py $(FONTS) | $(OXFMT) --stdin-filepath=fonts.css > $@

$(EMBEDS): $(VENV) $(FONTS)
	@$(PYTHON) make-faces.py --embed $(FONTS) | $(OXFMT) --stdin-filepath=fonts.css > $@

all: $(VENV) $(LATO) $(PLAYFAIR)
	rm -f $(FACES) $(EMBEDS)
	$(MAKE) -j8 $(FACES)
	$(MAKE) $(EMBEDS)
	@for font in $(LATO)/*.woff2 $(PLAYFAIR)/*.woff2; do \
	    diff -q "$$font" $(FONTS_DIR)/`basename "$$font"` || true; \
	done
	@if diff -u --color=auto $(FONTS_CSS) $(FACES); then \
		echo '\nfonts.css unchanged'; \
	else \
	    echo '\nInspect `$(FACES)` then run `make install` to update `$(FONTS_DIR)/*.woff2` and `$(FONTS_CSS)`'; \
	fi

report:
	@if [[ -z "$(LATO_WOFFS)" ]] || [[ -z "$(PLAYFAIR_WOFFS)" ]]; then \
	    echo 'First run `make all` to generate the web fonts'; \
	else \
		$(PYTHON) examine-subset.py "$(firstword $(LATO_WOFFS))" "$(LATIN_RANGE)"; \
		$(PYTHON) examine-subset.py "$(firstword $(PLAYFAIR_WOFFS))" "$(LATIN_RANGE)"; \
	fi

test:
	node test.js

install: $(FONTS) $(FACES)
	mkdir -p $(FONTS_DIR)
	cp $(FONTS) $(FONTS_DIR)
	cp $(EMBEDS) $(FONTS_DIR)
	cp $(FACES) $(FONTS_CSS)

clean:
	rm -rf $(VENV)
