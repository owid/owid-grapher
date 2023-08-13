PRETTIER := node ../../node_modules/prettier/bin-prettier.js
WOFF2 := woff2_compress
PYTHON := .env/bin/python3
PIP := .env/bin/pip3
.PHONY: all install clean build

default: all
BUILD_DIR := .env/build
FONTS_DIR := ../../public/fonts
FONTS_CSS := ../../public/fonts.css
FONTS = $(patsubst %.otf,%.woff2,$(wildcard $(PLAYFAIR)/*.otf $(LATO)/*.woff2))
FACES = $(BUILD_DIR)/fonts.css

LATO := $(BUILD_DIR)/lato
LATO_URL := https://www.latofonts.com/download/lato2oflweb-zip
$(LATO).zip:
	curl $(LATO_URL) -o $@
$(LATO): $(LATO).zip
	unzip -jo $< -d $@ '*/*/*/*.woff2'

PLAYFAIR := $(BUILD_DIR)/playfair
PLAYFAIR_URL := https://www.fontsquirrel.com/fonts/download/playfair-display
$(PLAYFAIR).zip:
	curl -L $(PLAYFAIR_URL) -o $@
$(PLAYFAIR): $(PLAYFAIR).zip
	unzip -jo $< -d $@ 'PlayfairDisplay-*.otf'

%.woff2: %.otf
	$(WOFF2) $<

$(BUILD_DIR):
	python3 -m venv $(dir $@)
	$(PIP) install -r requirements.txt
	mkdir -p $@

$(FACES): $(BUILD_DIR) $(FONTS)
	@$(PYTHON) make-faces.py $(FONTS) | $(PRETTIER) --parser css > $@

all: $(BUILD_DIR) $(LATO) $(PLAYFAIR)
	$(MAKE) $(FACES)
	@diff -u --color=auto $(FONTS_CSS) $(FACES) || true
	@printf '\nInspect `$(FACES)` then run `make install` to update `$(FONTS_DIR)/*.woff2` and `$(FONTS_CSS)`'

install: $(FONTS) $(FACES)
	mkdir -p $(FONTS_DIR)
	cp $(FONTS) $(FONTS_DIR)
	cp $(FACES) $(FONTS_CSS)

clean:
	rm -rf .env 