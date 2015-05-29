SOURCE = src/index.coffee
TARGET = ./lib/channel.js
TARGET_MIN = ./lib/channel.min.js
FLAGS = -t coffeeify --extension=".coffee"

WATCHIFY = ./node_modules/.bin/watchify
BROWSERIFY = ./node_modules/.bin/browserify
UGLIFYJS = ./node_modules/.bin/uglifyjs

NPM = npm

.PHONY: build clean watch

build:
	$(BROWSERIFY) $(FLAGS) $(SOURCE) -o $(TARGET)
	$(UGLIFYJS) $(TARGET) -c > $(TARGET_MIN)

watch:
	$(WATCHIFY) --verbose $(FLAGS) -o $(TARGET) -- $(SOURCE)

node_modules:
	$(NPM) install