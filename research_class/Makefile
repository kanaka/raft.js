PWD = $(shell pwd)
#export TEXINPUTS=.:$(PWD)/IEEEtran:$(PWD)/IEEEconf:
export TEXINPUTS=.:$(PWD)/IEEEtran:$(PWD)/acmsmall:$(PWD)/acmtog:
#export TEXINPUTS=.:$(PWD)/IEEEtran:

%.pdf: %.tex
	pdflatex -halt-on-error $<

all: paper.pdf
