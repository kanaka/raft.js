PWD = $(shell pwd)
#export TEXINPUTS=.:$(PWD)/IEEEtran:
#export TEXINPUTS=.:$(PWD)/IEEEtran:$(PWD)/IEEEconf:
#export TEXINPUTS=.:$(PWD)/IEEEtran:$(PWD)/acmsmall:$(PWD)/acmtog:$(PWD)/pgfplots//:

DATA = $(wildcard data/*)

REFERENCES = $(wildcard references/*)

paper.pdf: $(DATA) $(REFERENCES)

%.pdf: %.tex
	pdflatex -halt-on-error $<
	bibtex $*.aux
	pdflatex -halt-on-error $<
	pdflatex -halt-on-error $<

all: paper.pdf

clean:
	rm -f *.pdf *.bak *.log *.out *.aux *.run.xml paper-blx.bib paper.bbl paper.bcf paper.blg
