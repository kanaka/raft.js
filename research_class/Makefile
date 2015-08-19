PWD = $(shell pwd)
#export TEXINPUTS=.:$(PWD)/IEEEtran:$(PWD)/IEEEconf:
export TEXINPUTS=.:$(PWD)/IEEEtran:$(PWD)/acmsmall:$(PWD)/acmtog:$(PWD)/pgfplots//:
#export TEXINPUTS=.:$(PWD)/IEEEtran:

%.pdf: %.tex
	pdflatex -halt-on-error $<

all: paper.pdf
