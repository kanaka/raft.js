PWD = $(shell pwd)
#export TEXINPUTS=.:$(PWD)/IEEEtran:
#export TEXINPUTS=.:$(PWD)/IEEEtran:$(PWD)/IEEEconf:
#export TEXINPUTS=.:$(PWD)/IEEEtran:$(PWD)/acmsmall:$(PWD)/acmtog:$(PWD)/pgfplots//:

DATA = $(wildcard data/*)

paper.pdf: $(DATA)

%.pdf: %.tex
	pdflatex -halt-on-error $<

all: paper.pdf
