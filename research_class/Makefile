PWD = $(shell pwd)
#export TEXINPUTS=.:$(PWD)/IEEEtran:
#export TEXINPUTS=.:$(PWD)/IEEEtran:$(PWD)/IEEEconf:
#export TEXINPUTS=.:$(PWD)/IEEEtran:$(PWD)/acmsmall:$(PWD)/acmtog:$(PWD)/pgfplots//:

DATA = $(wildcard data/*)

REFERENCES = $(wildcard references/*)

all: paper.pdf paper-min.pdf

paper.pdf: $(DATA) $(REFERENCES)
paper-min.pdf: $(DATA) $(REFERENCES)

paper.pdf: paper.tex
	pdflatex -halt-on-error "\def\OPTIONAL{}\input{$<}"
	bibtex paper.aux
	pdflatex -halt-on-error "\def\OPTIONAL{}\input{$<}"
	pdflatex -halt-on-error "\def\OPTIONAL{}\input{$<}"

paper-min.pdf: paper.tex
	cp paper.tex paper-min.tex
	pdflatex -halt-on-error "\input{paper-min.tex}"
	bibtex paper-min.aux
	pdflatex -halt-on-error "\input{paper-min.tex}"
	pdflatex -halt-on-error "\input{paper-min.tex}"

workshop.pdf: workshop.tex
	pdflatex -halt-on-error "\input{$<}"
	bibtex workshop.aux
	pdflatex -halt-on-error "\input{$<}"
	pdflatex -halt-on-error "\input{$<}"

#%.pdf: %.tex
#	pdflatex -halt-on-error "$(if $(OPTIONAL),\def\OPTIONAL{},)\input{$<}"
#	bibtex $*.aux
#	pdflatex -halt-on-error "$(if $(OPTIONAL),\def\OPTIONAL{},)\input{$<}"
#	pdflatex -halt-on-error "$(if $(OPTIONAL),\def\OPTIONAL{},)\input{$<}"

clean:
	rm -f *.bak *.log *.out *.aux *.run.xml paper-blx.bib paper.bbl paper.bcf paper.blg paper-min.pdf
