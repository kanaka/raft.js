PWD = $(shell pwd)
#export TEXINPUTS=.:$(PWD)/IEEEtran:$(PWD)/IEEEconf:
export TEXINPUTS=.:$(PWD)/IEEEtran:$(PWD)/acmsmall:$(PWD)/acmtog:$(PWD)/pgfplots//:
#export TEXINPUTS=.:$(PWD)/IEEEtran:

DATA = $(wildcard data/*)

%.pdf: %.tex
	pdflatex -halt-on-error $<

paper.pdf: $(DATA)

all: paper.pdf
