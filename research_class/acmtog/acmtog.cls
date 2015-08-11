%% acmtog.cls - version 1.7
%% Aptara Inc./Gerry Murray, dated 07 March 2012
%% Boris Veytsman, 10 August 2013
%% (c) 2011-2013 Association for Computing Machinery (ACM)
%% For small trim journals
%%
%% If you face any problem while working with this class file or have any feedback/suggestion, 
%% please contact ACM Support helpline at: "acmtexsupport@aptaracorp.com".
%% Users can also go through the FAQs available on the journal's
%% submission webpage.
%%
%% Version 1.7: integrated with acmcopyright.sty
%%
%% Version 1.6: new copyright code
%% 
%% Version 1.5: added CCS code
%%
%% Version 1.4: added new copyright statements
%%
%% Version 1.2 (History)
%% ---------------------
%% 1) Introduction of \affil command
%% 2) Corrected the paper size for LaTeX and PdfLaTeX
%% 3) Made compatible with natbib.sty
%% 4) Trimmed the 'double outputting' of the DOI/URL beneath ACM Reference Format (before 1. INTRODUCTION)
%%    and also beneath the Permission Statement/copyright line. Also inserted the "http://dx.doi.org" stem. (Gerry Murray, March 2012)
%%
%% Steps to compile: latex, bibtex, latex latex
%%


%%
\def\fileversion{v1.7}
\def\filedate{August 10, 2013}
%
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{acmtog} [2013/08/10 v1.7 ACM Class]
\RequirePackage{latexsym}
\RequirePackage{url}

% ----------------
% Gerry - April 2011 - To assist in the formatting of the NEW ACM Reference format - 'DOI' in tt font, and url string in default
\usepackage{url}
\def\UrlFont{}
\newcommand{\BIBand}{\&}
\def\showDOI#1{\mbox{{\tt DOI:}{#1}}} % Gerry April 2011 - forces the DOI: to 'stay' with the 'url-(string)link' (no need for space at end either)
% ----------------
%
\newif\ifmanuscript
\@twosidetrue\@mparswitchtrue
%
\newdimen\trimheight
\newdimen\trimwidth
\newdimen\typeheight
\newdimen\typewidth
\newdimen\normaltextheight
\newdimen\blindfoliodrop
\newbox\tempbox
%%
\def\acmVolume#1{\def\@acmVolume{#1}}
\def\acmNumber#1{\def\@acmNumber{#1}}
\def\acmYear#1{\def\@acmYear{#1}}
\def\acmMonth#1{\def\@acmMonth{#1}}
\def\doi#1{\def\@doi{#1}}
\def\@journalName{ACM Transactions on Graphics}
\def\@permissionCodeOne{0730-0301}
%

\gdef\doiline{{\tt DOI:} \@doi} % Gerry - March 2012
% Beneath copyright line and in the ACM Reference Format before 1. INTRODUCTION
% The 'value' of @doi is 'provided' in the source .tex otherwise it's XXXXXXXXXXX.YYYYYYYYYYY 

%
\frenchspacing
\DeclareOption{manuscript}{\manuscripttrue}
\DeclareOption{letterpaper}
   {\setlength\paperheight {11in}%
    \setlength\paperwidth  {8.5in}%
    \def\special@paper{8.5in,11in}
	\special{papersize=8.5in,11in}}
%
\ExecuteOptions{letterpaper}
\ProcessOptions

\RequirePackage{ifpdf}%
\ifpdf
\pdfpagewidth=8.5in
\pdfpageheight=11in
\fi


%
\newcommand{\ignoretwo}[2]{}
\newcommand{\yearTwoDigits}{\expandafter\ignoretwo\the\year}
\def\@setref#1#2#3{%
  \ifx#1\relax
    \number 0\relax
    \protect\G@refundefinedtrue
    \nfss@text{\reset@font\bfseries ??}%
    \@latex@warning{Reference `#3' on page \thepage \space undefined}%
  \else
    \expandafter#2#1\null
  \fi}
%
%
\lineskip 1pt \normallineskip 1pt
\ifmanuscript
\def\baselinestretch{2}
\else
\def\baselinestretch{1}
\fi
\def\@ixpt{9}
\renewcommand\normalsize{%
  \@setfontsize\normalsize\@ixpt{10pt}
  \abovedisplayskip 6pt plus2pt minus1pt\belowdisplayskip \abovedisplayskip
  \abovedisplayshortskip 6pt plus0pt minus 3pt
  \belowdisplayshortskip 6pt plus0pt minus3pt\let\@listi\@listI} 

\newcommand\small{%
  \@setfontsize\small\@ixpt{11pt}%
  \abovedisplayskip 5pt plus 2pt minus 1pt\belowdisplayskip \abovedisplayskip
  \abovedisplayshortskip 5pt plus0pt minus2pt\belowdisplayshortskip 5pt plus0pt
      minus 2pt
  \def\@listi{\leftmargin\leftmargini \topsep 5pt plus 2pt minus 1pt\parsep 0pt
    plus .7pt 
  \itemsep 1.6pt plus .8pt}}
\newcommand\footnotesize{%
%   \@setfontsize\footnotesize\@viiipt{10pt}
 \@setsize\footnotesize{10pt}\viiipt\@viiipt
  \abovedisplayskip 4pt plus 1pt minus 0pt\belowdisplayskip \abovedisplayskip
  \abovedisplayshortskip 4pt plus 0pt minus 1pt\belowdisplayshortskip 4pt plus
       0pt minus 1pt
  \def\@listi{\leftmargin\leftmargini \topsep 4pt plus 1pt minus
     0pt\parsep 0pt plus .5pt 
     \itemsep 1pt plus .7pt}}

\newcommand\scriptsize{\@setfontsize\scriptsize\@viipt\@viiipt}
\newcommand\tiny{\@setfontsize\tiny\@vpt\@vipt}
\newcommand\large{\@setfontsize\large\@xiipt{14}}
\newcommand\Large{\@setfontsize\Large\@xivpt{18}}
\newcommand\LARGE{\@setfontsize\LARGE\@xviipt{20}}
\newcommand\huge{\@setfontsize\huge\@xxpt{25}}
\newcommand\Huge{\@setfontsize\Huge\@xxvpt{30}}
%
\normalsize 
%
\newdimen\tempdimen  
%
\setlength\trimheight{11in}
\setlength\trimwidth{8.5in}
%
\typeheight52.5pc
\typewidth42pc
\textheight52.5pc
\textwidth42pc
\advance\textheight-3pt
\newdimen\normaltextheight
\setlength\normaltextheight{\textheight}
\oddsidemargin4.5pc
\evensidemargin4.5pc
\topmargin52pt %.25in
\headheight 6pt%
\headsep 19.2pt%
\topskip6pt%
\footskip 15pt 
%
\marginparwidth 0.5in 
\marginparsep .125in 
\columnsep24pt
\columnseprule 0pt 
%
\def\titlefont{\fontfamily{phv}\fontsize{18}{20}\selectfont\raggedright\mathversion{bold}}
\def\authorfont{\fontfamily{phv}\fontsize{10}{12}\selectfont\rightskip0pt plus1fill} %\mathversion{sfnormal}
\def\rhfont{\fontfamily{phv}\fontsize{9}{10}\selectfont\mathversion{sfnormal}}
\def\sectionfont{\fontfamily{phv}\fontsize{10}{12}\capsshape\selectfont\raggedright} %\mathversion{sfnormal}
\def\subsectionfont{\fontfamily{phv}\fontsize{10}{12}\selectfont} %\mathversion{sfnormal}
\def\figcaptionfont{\fontsize{8}{10}\selectfont\mathversion{normal}}%
\def\subcaptionfont{\fontsize{8}{10}\selectfont\mathversion{normal}}%
\def\subcaption#1{{\centering\subcaptionfont#1\par}}
%
\def\tablefont{\fontsize{8}{10}\selectfont}%
\def\tablecaptionfont{\fontsize{9}{11}\selectfont\centering}%
\def\tablenumfont{\fontsize{9}{11}\selectfont}%
\def\tabnotefont{\fontsize{7}{9}\selectfont}
%
\def\encodingdefault{OT1}%
\fontencoding{OT1}%
%
%\def\encodingdefault{T1}% Gerry (for me)
%\fontencoding{T1}%        Gerry (for me)
%
\DeclareFontShape{OMS}{cmsy}{m}{n}{<-> cmsy10 }{}   
\DeclareFontShape{OMS}{cmsy}{b}{n}{<-> cmbsy10 }{} 
%
% orig \DeclareFontShape{OMS}{cmsy}{m}{n}{<-> cmsy10 }{}  % These two 
% orig \DeclareFontShape{OMS}{cmsy}{b}{n}{<-> cmbsy10 }{} % are problematic (for some(my) systems) Gerry
\def\cal{\mathcal}
%
\def\boldmath{\mathversion{bold}}
\def\bm#1{\mathchoice
          {\mbox{\boldmath$\displaystyle#1$}}%
          {\mbox{\boldmath$#1$}}%
          {\mbox{\boldmath$\scriptstyle#1$}}%
          {\mbox{\boldmath$\scriptscriptstyle#1$}}}
%
\footnotesep 7pt
\skip\footins 15pt plus 4pt minus 3pt 
\floatsep 12pt plus 2pt minus 2pt 
\textfloatsep \floatsep 
\intextsep 1pc plus 1pc 
\dblfloatsep 12pt plus 2pt minus 2pt 
\dbltextfloatsep 20pt plus 2pt minus 4pt 
\@fptop 0pt plus 1fil \@fpsep 1pc plus 2fil \@fpbot 0pt plus 1fil 
\@dblfptop 0pt plus 1fil \@dblfpsep 8pt plus 2fil \@dblfpbot 0pt plus 1fil
\marginparpush 6pt 
\parskip 0pt \parindent 9pt \partopsep 0pt  % plus .1pt FBU
\@lowpenalty 51 \@medpenalty 151 \@highpenalty 301 
\@beginparpenalty -\@lowpenalty \@endparpenalty -\@lowpenalty \@itempenalty
-\@lowpenalty 
%
\def\part{\@ucheadtrue
 \@startsection{part}{9}{\z@}{-10pt plus -4pt minus 
 -2pt}{4pt}{\reset@font\normalsize\sffamily}}
\def\section{\@ucheadtrue
 \@startsection{section}{1}{\z@}{-10pt plus -4pt minus 
 -2pt}{6pt}{\reset@font\fontsize{10}{12}\raggedright\sffamily}}
\def\subsection{\@ucheadfalse
 \@startsection{subsection}{2}{\z@}{-8pt plus -2pt minus 
 -1pt}{6pt}{\reset@font\fontsize{10}{12}\raggedright\sffamily}}
\def\subsubsection{\@ucheadfalse
 \@startsection{subsubsection}{3}{\parindent}{6pt plus 
1pt}{-5pt}{\reset@font\fontsize{9}{10}\itshape}}
\def\paragraph{\@ucheadfalse
 \@startsection{paragraph}{3}{\parindent}{6pt plus 
1pt}{-5pt}{\reset@font\fontsize{10}{12}\itshape}}
%%
\renewcommand{\@seccntformat}[1]{\textup{\csname the#1\endcsname}}
\gdef\@period{.}
\def\@trivlist{\@topsepadd\topsep
\if@noskipsec \gdef\@period{}\leavevmode\gdef\@period{.}\fi
 \ifvmode \advance\@topsepadd\partopsep \else \unskip\par\fi
 \if@inlabel \@noparitemtrue \@noparlisttrue 
 \else \@noparlistfalse \@topsep\@topsepadd \fi
 \advance\@topsep \parskip
 \leftskip\z@\rightskip\@rightskip \parfillskip\@flushglue
 \@setpar{\if@newlist\else{\@@par}\fi} \global\@newlisttrue
\@outerparskip\parskip}
%
\def\@startsection#1#2#3#4#5#6{%
  \if@noskipsec \leavevmode \fi
  \par
  \@tempskipa #4\relax
  \@afterindenttrue
  \ifdim \@tempskipa <\z@
    \@tempskipa -\@tempskipa \@afterindentfalse
  \fi
  \if@nobreak
    \everypar{}%
    \ifnum#2=2
	    \vskip-2pt 
	   \fi
  \else
    \addpenalty\@secpenalty\addvspace\@tempskipa
  \fi
  \@ifstar
    {\@ssect{#3}{#4}{#5}{#6}}%
    {\@dblarg{\@sect{#1}{#2}{#3}{#4}{#5}{#6}}}}
%
\def\@sect#1#2#3#4#5#6[#7]#8{%
  \ifnum #2>\c@secnumdepth
    \let\@svsec\@empty
  \else
    \refstepcounter{#1}%
      \if@uchead%
            \protected@edef\@svsec{\@seccntformat{#1}.\quad\relax}%
        \else%
            \protected@edef\@svsec{\@seccntformat{#1}\quad\relax}%
        \fi%
  \fi
  \@tempskipa #5\relax
  \ifdim \@tempskipa>\z@
    \begingroup
      #6{%
        \@hangfrom{\hskip #3\relax\@svsec}%
          \interlinepenalty \@M \if@uchead\MakeUppercase{#8}\else#8\fi \@@par}%
    \endgroup
    \csname #1mark\endcsname{#7}%
    \addcontentsline{toc}{#1}{%
      \ifnum #2>\c@secnumdepth \else
        \protect\numberline{\csname the#1\endcsname}%
      \fi
      #7}%
  \else
    \def\@svsechd{%
      #6{\hskip #3\relax
      \@svsec \if@uchead\Makeuppercase{#8}\else#8\fi}%
      \csname #1mark\endcsname{#7}%
      \addcontentsline{toc}{#1}{%
        \ifnum #2>\c@secnumdepth \else
          \protect\numberline{\csname the#1\endcsname}%
        \fi
        #7}}%
  \fi
  \@xsect{#5}}

\def\@xsect#1{\@tempskipa #1\relax
 \ifdim \@tempskipa>\z@
 \par \nobreak
 \vskip \@tempskipa
 \@afterheading
 \else \global\@nobreakfalse \global\@noskipsectrue
 \everypar{\if@noskipsec \global\@noskipsecfalse
 \clubpenalty\@M \hskip -\parindent
 \begingroup \@svsechd\@period \endgroup \unskip
 \hskip -#1
 \else \clubpenalty \@clubpenalty
 \everypar{}\fi}\fi\ignorespaces}
\newif\if@uchead\@ucheadfalse
%
\setcounter{secnumdepth}{3}
\newcounter{secnumbookdepth}
\setcounter{secnumbookdepth}{3}
\newfont{\apbf}{cmbx9}
\def\appendix{\par
 \setcounter{section}{0}
 \setcounter{subsection}{0}
  \section*{APPENDIX}\vskip10pt
        \def\thesection{\Alph{section}}
        \def\theHsection{\Alph{section}}}
%
\labelsep 4pt
\settowidth{\leftmargini}{(9)} \addtolength\leftmargini\labelsep
\settowidth{\leftmarginii}{(b)} \addtolength\leftmarginii\labelsep
\leftmarginiii \leftmarginii
\leftmarginiv \leftmarginii 
\leftmarginv \leftmarginii 
\leftmarginvi \leftmarginii 
\leftmargin\leftmargini
\labelwidth\leftmargini\advance\labelwidth-\labelsep
\def\@listI{\leftmargin\leftmargini \parsep 0pt plus 1pt\topsep 6pt plus 2pt
minus 2pt\itemsep 2pt plus 1pt minus .5pt}
\let\@listi\@listI
\@listi 
\def\@listii{\leftmargin\leftmarginii
 \labelwidth\leftmarginii\advance\labelwidth-\labelsep
 \topsep 0pt plus 1pt 
 \parsep 0pt plus .5pt 
 \itemsep \parsep}
\def\@listiii{\leftmargin\leftmarginiii
 \labelwidth\leftmarginiii\advance\labelwidth-\labelsep
 \topsep 0pt plus 1pt 
 \parsep 0pt plus .5pt 
 \itemsep \parsep}
\def\@listiv{\leftmargin\leftmarginiv
 \labelwidth\leftmarginiv\advance\labelwidth-\labelsep}
\def\@listv{\leftmargin\leftmarginv
 \labelwidth\leftmarginv\advance\labelwidth-\labelsep}
\def\@listvi{\leftmargin\leftmarginvi
 \labelwidth\leftmarginvi\advance\labelwidth-\labelsep}
%
\def\enumerate{\ifnum \@enumdepth >3 \@toodeep\else
 \advance\@enumdepth \@ne 
 \edef\@enumctr{enum\romannumeral\the\@enumdepth}\list
 {\csname label\@enumctr\endcsname}{\usecounter
 {\@enumctr}\def\makelabel##1{##1\hss}}\fi}
\def\longenum{\ifnum \@enumdepth >3 \@toodeep\else
 \advance\@enumdepth \@ne 
 \edef\@enumctr{enum\romannumeral\the\@enumdepth}\list
 {\csname label\@enumctr\endcsname}{\usecounter
 {\@enumctr}\labelwidth\z@}\fi}
\let\endlongenum\endlist
\def\labelenumi{{\rm (}\arabic{enumi}\/{\rm )}} 
\def\theenumi{\arabic{enumi}} 
\def\labelenumii{{\rm (}\alph{enumii}\rm{)}}
\def\theenumii{\alph{enumii}}
\def\p@enumii{\theenumi}
\def\labelenumiii{\roman{enumiii}.}
\def\theenumiii{\roman{enumiii}}
\def\p@enumiii{\theenumi{\rm (}\theenumii{\rm )}}
\def\labelenumiv{\Alph{enumiv}.}
\def\theenumiv{\Alph{enumiv}} 
\def\p@enumiv{\p@enumiii\theenumiii}

\def\p@enumiv{\p@enumiii\theenumiii}

\def\itemize{\list{---\hskip -\labelsep}{\settowidth
 {\leftmargin}{---}\labelwidth\leftmargin
 \addtolength{\labelwidth}{-\labelsep}}}
\let\enditemize\endlist
\def\longitem{\list{---}{\labelwidth\z@
 \leftmargin\z@ \itemindent\parindent \advance\itemindent\labelsep}}
\let\endlongitem\endlist
\def\verse{\let\\=\@centercr 
 \list{}{\leftmargin 2pc 
 \itemindent -1.5em\listparindent \itemindent 
 \rightmargin\leftmargin\advance\leftmargin 1.5em}\item[]}
\let\endverse\endlist
\def\quotation{\list{}{\leftmargin 2pc \listparindent .5em
 \itemindent\listparindent
 \rightmargin\leftmargin \parsep 0pt plus 1pt}\item[]}
\let\endquotation=\endlist
\def\quote{\list{}{\leftmargin 2pc \rightmargin\leftmargin}\item[]}
\let\endquote=\endlist

%
\newenvironment{unnumlist}{%
    \list{}{%
    \listparindent\parindent
    \itemindent-1em
    \leftmargin1em
    \parsep0pt
    \itemsep2pt
    \partopsep0pt}
    \def\makelable##1{##1}%
}{\endlist}%
%
\def\description{\list{}{\listparindent\parindent\labelwidth\z@
 \leftmargin\z@ \itemindent\parindent\advance\itemindent\labelsep
 \def\makelabel##1{\it ##1}}}
\let\enddescription\endlist
%
\def\describe#1{\list{}{\listparindent\parindent\settowidth{\labelwidth}{#1}\leftmargin
 \labelwidth\addtolength\leftmargin\labelsep\def\makelabel##1{##1\hfil}}}
\let\enddescribe\endlist
%
\def\program{\ifx\@currsize\normalsize\small \else \rm \fi\tabbing}
\let\endprogram\endtabbing
%
\newtheorem{theorem}{Theorem}
\newtheorem{strategy}{Strategy}
\newtheorem{property}{Property}
\newtheorem{proposition}{Proposition}
\newtheorem{lemma}[theorem]{Lemma}
\newtheorem{exam}{Example}
\newenvironment{example}{%
\italicenvfalse
\begin{exam}}{\end{exam}\italicenvtrue}
%
\newtheorem{defi}[theorem]{Definition}
\newenvironment{definition}{%
\italicenvfalse
\begin{defi}}{\end{defi}\italicenvtrue}
%
\def\@begintheorem#1#2{\trivlist \item[\hskip 10pt\hskip 
   \labelsep{\sc{#1}\hskip 5pt\relax #2.}] \itshape}
%
\def\@opargbegintheorem#1#2#3{\trivlist
     \item[\hskip 10pt \hskip 
\labelsep{\sc{#1}\savebox\@tempboxa{\sc{#3}}\ifdim 
        \wd\@tempboxa>\z@ \hskip 5pt\relax \sc{#2}  \box\@tempboxa\fi.}]
\itshape}
%
\newif\if@qeded\global\@qededfalse
\def\proof{\global\@qededfalse\@ifnextchar[{\@xproof}{\@proof}}
\def\endproof{\if@qeded\else\qed\fi\endtrivlist}
\def\qed{\unskip\kern 10pt{\unitlength1pt\linethickness{.4pt}\framebox(5,5){}}
\global\@qededtrue}
\def\@proof{\trivlist \item[\hskip 10pt\hskip 
 \labelsep{\sc Proof.}]\ignorespaces}
\def\@xproof[#1]{\trivlist \item[\hskip 10pt\hskip 
 \labelsep{\sc Proof #1.}]\ignorespaces}
%
\def\newdef#1#2{\expandafter\@ifdefinable\csname #1\endcsname
{\@definecounter{#1}\expandafter\xdef\csname
the#1\endcsname{\@thmcounter{#1}}\global
 \@namedef{#1}{\@defthm{#1}{#2}}\global
 \@namedef{end#1}{\@endtheorem}}}
\def\@defthm#1#2{\refstepcounter
 {#1}\@ifnextchar[{\@ydefthm{#1}{#2}}{\@xdefthm{#1}{#2}}}
\def\@xdefthm#1#2{\@begindef{#2}{\csname the#1\endcsname}\ignorespaces}
\def\@ydefthm#1#2[#3]{\trivlist \item[\hskip 10pt\hskip 
 \labelsep{\it #2\savebox\@tempboxa{#3}\ifdim 
 \wd\@tempboxa>\z@ \ \box\@tempboxa\fi.}]\ignorespaces}
\def\@begindef#1#2{\trivlist \item[\hskip 10pt\hskip 
 \labelsep{\it #1\ \rm #2.}]}
%
\def\theequation{\arabic{equation}}
%
\def\titlepage{\@restonecolfalse\if@twocolumn\@restonecoltrue\onecolumn
 \else \newpage \fi \thispagestyle{empty}\c@page\z@}
\def\endtitlepage{\if@restonecol\twocolumn \else \newpage \fi}
%
\arraycolsep 2.5pt \tabcolsep 6pt \arrayrulewidth .4pt \doublerulesep 2pt 
\tabbingsep \labelsep 
%
\skip\@mpfootins = \skip\footins
\fboxsep = 3pt \fboxrule = .4pt 
%
\newcounter{part}
\newcounter{section}
\newcounter{subsection}[section]
\newcounter{subsubsection}[subsection]
\newcounter{paragraph}[subsubsection]
%
\def\thepart{\Roman{part}} 
\def\thesection {\arabic{section}}
\def\thesubsection {\thesection.\arabic{subsection}}
\def\thesubsubsection {\thesubsection.\arabic{subsubsection}}
\def\theparagraph {\thesubsubsection.\arabic{paragraph}}

\def\@pnumwidth{1.55em}
\def\@tocrmarg {2.55em}
\def\@dotsep{4.5}
\setcounter{tocdepth}{3}

\def\tableofcontents{\section*{Contents\@mkboth{CONTENTS}{CONTENTS}}
 \@starttoc{toc}}
\def\l@part#1#2{\addpenalty{\@secpenalty}
 \addvspace{2.25em plus 1pt} \begingroup
 \@tempdima 3em \parindent \z@ \rightskip \@pnumwidth \parfillskip
-\@pnumwidth 
 {\large \bf \leavevmode #1\hfil \hbox to\@pnumwidth{\hss #2}}\par
 \nobreak \endgroup}
\def\l@section#1#2{\addpenalty{\@secpenalty} \addvspace{1.0em plus 1pt}
\@tempdima 1.5em \begingroup
 \parindent \z@ \rightskip \@pnumwidth 
 \parfillskip -\@pnumwidth 
 \bf \leavevmode #1\hfil \hbox to\@pnumwidth{\hss #2}\par
 \endgroup}
\def\l@subsection{\@dottedtocline{2}{1.5em}{2.3em}}
\def\l@subsubsection{\@dottedtocline{3}{3.8em}{3.2em}}
\def\listoffigures{\section*{List of Figures\@mkboth
 {LIST OF FIGURES}{LIST OF FIGURES}}\@starttoc{lof}}
\def\l@figure{\@dottedtocline{1}{1.5em}{2.3em}}
\def\listoftables{\section*{List of Tables\@mkboth
 {LIST OF TABLES}{LIST OF TABLES}}\@starttoc{lot}}
\let\l@table\l@figure
%
\newif\if@restonecol
\def\theindex{\@restonecoltrue\if@twocolumn\@restonecolfalse\fi
\columnseprule \z@
\columnsep 35pt\twocolumn[\section*{Index}]
 \@mkboth{INDEX}{INDEX}\thispagestyle{plain}\parindent\z@
 \parskip\z@ plus .3pt\relax\let\item\@idxitem}
\def\@idxitem{\par\hangindent 40pt}
\def\subitem{\par\hangindent 40pt \hspace*{20pt}}
\def\subsubitem{\par\hangindent 40pt \hspace*{30pt}}
\def\endtheindex{\if@restonecol\onecolumn\else\clearpage\fi}
\def\indexspace{\par \vskip 10pt plus 5pt minus 3pt\relax}
%
\def\footnoterule{\kern-3\p@
 \hrule \@height 0.2\p@ \@width 47\p@ 
  \kern 2.6\p@
} 

\long\def\@makefntext#1{\parindent 1em\noindent 
 $^{\@thefnmark}$#1}
%
\setcounter{topnumber}{3}
\def\topfraction{.99}
\setcounter{bottomnumber}{1}
\def\bottomfraction{.5}
\setcounter{totalnumber}{3}
\def\textfraction{.01}
\def\floatpagefraction{.85}
\setcounter{dbltopnumber}{2}
\def\dbltopfraction{.95}
\def\dblfloatpagefraction{.96}
%
\long\def\@makecaption#1#2{\vskip 1pc \setbox\@tempboxa\hbox{#1.\hskip
1em\relax #2}
 \ifdim \wd\@tempboxa >\hsize #1. #2\par \else \hbox
to\hsize{\hfil\box\@tempboxa\hfil} 
 \fi}

\def\nocaption{\refstepcounter\@captype \par
 \vskip 1pc \hbox to\hsize{\hfil \footnotesize Figure \thefigure
 \hfil}}
%
\newcounter{figure}
\def\thefigure{\@arabic\c@figure}
\def\fps@figure{tbp}
\def\ftype@figure{1}
\def\ext@figure{lof}
\def\fnum@figure{Fig.\ \thefigure}%
\def\figure{\let\normalsize\footnotesize\normalsize\@float{figure}}
\let\endfigure\end@float
\@namedef{figure*}{\@dblfloat{figure}}
\@namedef{endfigure*}{\end@dblfloat}
%
\newcounter{table}
\def\thetable{\@Roman\c@table}
\def\fps@table{tbp}
\def\ftype@table{2}
\def\ext@table{lot}
\newlength\belowcaptionskip
\setlength\belowcaptionskip{1\p@}
%
\def\FigName{figure}%
\long\def\@caption#1[#2]#3{\par\begingroup
    \@parboxrestore
    \normalsize
    \@makecaption{\csname fnum@#1\endcsname}{\ignorespaces #3}\par
  \endgroup}
%
%
\newbox\tbbox
\long\def\@makecaption#1#2{%
  \ifx\FigName\@captype
    \vskip 7.3pt
    \setbox\@tempboxa\hbox{\figcaptionfont{#1}.\hskip7.3pt\relax #2\par}%
    \ifdim \wd\@tempboxa >\hsize
        \figcaptionfont{#1}.\hskip7.3pt\relax #2\par
    \else
        \centerline{\box\@tempboxa}%
    \fi
  \else%
    \setbox\tbbox=\vbox{\hsize\tempdimen{\tablenumfont #1}\ {\tablecaptionfont #2\par}}%
    \setbox\@tempboxa\hbox{\hsize\tempdimen{\tablenumfont #1}\ {\tablecaptionfont #2\par}\vphantom{jgq}}%
    \ifdim \wd\@tempboxa >\tempdimen
        \centerline{\box\tbbox}%        
    \else
        \centerline{\box\@tempboxa}%
    \fi
    \vskip\belowcaptionskip
  \fi}
%
\def\fnum@table{Table~\thetable.\ }
\def\table{\let\normalsize\footnotesize \normalsize\@float{table}}
\let\endtable\end@float
\@namedef{table*}{\@dblfloat{table}}
\@namedef{endtable*}{\end@dblfloat}
\def\acmtable#1{\@narrowfig #1\relax
 \let\caption\@atcap \let\nocaption\@atnocap
 \def\@tmpnf{}\@ifnextchar[{\@xntab}{\@ntab}}
\def\endacmtable{\hbox to \textwidth{\hfil
\vbox{\hsize \@narrowfig
\box\@nfcapbox
{\baselineskip 4pt \hbox{\vrule height .4pt width \hsize}}
\vskip -1pt
\box\@nfigbox\vskip -1pt
{\baselineskip 4pt \hbox{\vrule height .4pt width \hsize}}}\hfil}
\end@float}
\def\@xntab[#1]{\def\@tmpnf{[#1]}\@ntab}
\def\@ntab{\expandafter\table\@tmpnf
 \setbox\@nfigbox\vbox\bgroup
 \hsize \@narrowfig \@parboxrestore}
\def\@atmakecap #1#2{\setbox\@tempboxa\hbox{#1.\hskip 1em\relax #2}
 \ifdim \wd\@tempboxa >\hsize \sloppy #1.\hskip 1em\relax #2 \par \else \hbox
to\hsize{\hfil\box\@tempboxa\hfil}
 \fi}
\def\@atcap{\par\egroup\refstepcounter\@captype 
 \@dblarg{\@atcapx\@captype}}
\long\def\@atcapx#1[#2]#3{\setbox\@nfcapbox\vbox {\hsize \wd\@nfigbox
 \@parboxrestore
 \@atmakecap{\csname fnum@#1\endcsname}{\ignorespaces #3}\par}}
\def\@atnocap{\egroup \refstepcounter\@captype 
 \setbox\@nfcapbox\vbox {\hsize \wd\@nfigbox
 \hbox to\hsize{\hfil \footnotesize Table \thetable\hfil}}}
%
\newdimen\tabledim
%
\long\def\tbl#1#2{%
 \setbox\tempbox\hbox{\tablefont #2}%
 \tabledim\hsize\advance\tabledim by -\wd\tempbox
 \tempdimen\wd\tempbox
	\global\divide\tabledim\tw@
 \caption{#1}
	\centerline{\box\tempbox}
  }%
% 
\newenvironment{tabnote}{%
\par%\addvspace{-1pt}
\tabnotefont
\@ifnextchar[{\@tabnote}{\@tabnote[]}}{%
\par}
\def\@tabnote[#1]{\def\@Tempa{#1}\leftskip\tabledim\rightskip\leftskip\ifx\@Tempa\@empty\else{\it #1:}\ \fi\ignorespaces}
%
\def\tabnoteentry#1#2{\parindent0pt\par\@hangfrom{#1}{#2}}
\def\Note#1#2{\parindent0pt\par\hangindent3.7pt{\it #1}\ #2}
%

\def\Hline{%
  \noalign{\ifnum0=`}\fi\hrule \@height .5pt \futurelet
   \@tempa\@xhline}
%
\def\narrowfig#1{\@narrowfig #1\relax
 \let\caption\@nfcap \let\nocaption\@nfnocap
 \def\@tmpnf{}\@ifnextchar[{\@xnfig}{\@nfig}}
\def\endnarrowfig{\hbox to \textwidth{\if@nfeven
 \box\@nfcapbox\hfil\box\@nfigbox
 \else \box\@nfigbox\hfil\box\@nfcapbox\fi}\end@float}
\def\@xnfig[#1]{\def\@tmpnf{[#1]}\@nfig}
\def\@nfig{\expandafter\figure\@tmpnf
 \setbox\@nfigbox\vbox\bgroup
 \hsize \@narrowfig \@parboxrestore}
\def\@nfmakecap #1#2{\setbox\@tempboxa\hbox{#1.\hskip 1em\relax #2}
 \ifdim \wd\@tempboxa >\hsize \sloppy #1.\hskip 1em\relax #2 \par \else \hbox
to\hsize{\if@nfeven\else\hfil\fi\box\@tempboxa\if@nfeven\hfil\fi}
 \fi}
\def\@nfcap{\par\egroup\refstepcounter\@captype 
 \@dblarg{\@nfcapx\@captype}}
\long\def\@nfcapx#1[#2]#3{\@seteven
 \setbox\@nfcapbox\vbox to \ht\@nfigbox
 {\hsize \textwidth \advance\hsize -2pc \advance\hsize -\wd\@nfigbox
 \@parboxrestore
 \vfil 
 \@nfmakecap{\csname fnum@#1\endcsname}{\ignorespaces #3}\par
 \vfil}}
\def\@nfnocap{\egroup \refstepcounter\@captype \@seteven
 \setbox\@nfcapbox\vbox to \ht\@nfigbox
 {\hsize \textwidth \advance\hsize -2pc \advance\hsize -\wd\@nfigbox
 \@parboxrestore
 \vfil 
 \hbox to\hsize{\if@nfeven\else\hfil\fi 
 \footnotesize Figure \thefigure
 \if@nfeven\hfil\fi}
 \vfil}}
\def\@seteven{\@nfeventrue 
   \@ifundefined{r@@nf\thefigure}{}{%
      \edef\@tmpnf{\csname r@@nf\thefigure\endcsname}%
      \edef\@tmpnf{\expandafter\@getpagenum\@tmpnf}%
      \ifodd\@tmpnf\relax\@nfevenfalse\fi}%
\label{@nf\thefigure}\edef\@tmpnfx{\if@nfeven e\else o\fi}
\edef\@tmpnf{\write\@unused {\noexpand\ifodd \noexpand\c@page 
 \noexpand\if \@tmpnfx e\noexpand\@nfmsg{\thefigure} \noexpand\fi
 \noexpand\else 
 \noexpand\if \@tmpnfx o\noexpand\@nfmsg{\thefigure}\noexpand\fi 
 \noexpand\fi }}\@tmpnf}
\def\@nfmsg#1{Bad narrowfig: Figure #1 on page \thepage}

\newdimen\@narrowfig
\newbox\@nfigbox
\newbox\@nfcapbox
\newif\if@nfeven 

\def\affil#1{\par#1\par}
\def\and{\par and\par}




\def\@acmPrice{15.00} %article price  % Changed to 15 - June 2012 - Gerry


% ISSN
%
\def\issn#1{\gdef\@issn{#1}}
\issn{}

% Copyright Information
%
\RequirePackage{acmcopyright}

\def\maketitle{%
   \thispagestyle{titlepage}%
     \newpage
     \global\@topnum\z@
     \twocolumn[\@maketitle]%
    \let\maketitle\relax
    \global\let\@sponsors\@empty
}
%
\def\@maketitle{\newpage \thispagestyle{titlepage}\par
 \begingroup \lineskip = \z@\null \vskip -7pt\relax %-24.5pt
 \parindent\z@ \LARGE {\raggedright \hyphenpenalty\@M
  {\titlefont \@title} \par
 \global\firstfoot %aiellom
 \global\runningfoot %aiellom
}
\label{@firstpg}
{ \vskip 13.5pt\relax \fontsize{10}{12}\selectfont \sf %vskip 13.5pt between title and author
 \begingroup \addtolength{\baselineskip}{2pt}
 \@author\par \vskip -2pt 
 \endgroup }
 \vskip 23pt\relax
 \endgroup
 }
%
\gdef\copyrightline{%
  \if@printcopyright
  \copyright\ \@acmYear\ \@copyrightowner\  
  \else
  \@acmYear\ 
  \fi
  \$\@acmPrice}



\long\def\permission{\par%
  \@copyrightpermission
  \par
 \copyrightline\\
\doiline}

%
\newbox\@abstract
\newbox\@terms
\newbox\@keywords
%
\newenvironment{abstract}
	       {\par\footnotesize\noindent\ignorespaces}
	       {\par\vskip5pt%
		\def\and{\unskip\/{\rm ; }}
 {\footnotesize\noindent 
   \ifx\@categories\@empty\else
   Categories and Subject Descriptors: \@categories\par\vskip5pt\fi
   \ifx\@concepts\@empty\else
   CCS Concepts: \@concepts\par\vskip5pt\fi
% \ifvoid\@terms\else\box\@terms\par\vskip5pt\fi
 \@keywords \par\ifx\@acmformat\empty\else\vskip5pt\@acmformat\par\fi}\vskip24pt}
%
\def\terms#1{\setbox\@terms=\vbox{\hsize20pc%
 \footnotesize%
\parindent 0pt \noindent 
 General Terms: \ignorespaces #1}}
\def\keywords#1{\gdef\@keywords{\hsize20pc%
\parindent 0pt\noindent\ignorespaces% 
 Additional Key Words and Phrases: \ignorespaces #1}
}


\def\category#1#2#3{\@ifnextchar
 [{\@category{#1}{#2}{#3}}{\@xcategory{#1}{#2}{#3}}}
\def\@category#1#2#3[#4]{\edef\@tempa{\ifx \@categories\@empty 
 \else ; \fi}{\def\protect{\noexpand\protect
 \noexpand}\def\and{\noexpand\and}\xdef\@categories{\@categories\@tempa #1
[{\bf #2}]: 
 #3\kern\z@---\hskip\z@{\it #4}}}}
\def\@xcategory#1#2#3{\edef\@tempa{\ifx \@categories\@empty \else ;
\fi}{\def\protect{\noexpand\protect\noexpand}\def\and{\noexpand
 \and}\xdef\@categories{\@categories\@tempa #1 [{\bf #2}]: #3}}}
\let\@categories\@empty
\def\bottomstuff{\global\@topnum\z@ \global\@botroom \textheight \begin{figure}%\hsize\textwidth
\parindent\z@
\footnotesize
\hbox{}
\vskip -\textfloatsep
\vskip 10pt
\hrule height .2pt width0.45\columnwidth% \@acmWidth
\vskip 2pt\rule{0pt}{10pt}\ignorespaces}
\def\endbottomstuff{\fontsize{7pt}{8pt}\fontfamily{ptm}\selectfont
\permission\end{figure}\gdef\permission{}}

% Support for CCSXML file
\RequirePackage{comment}
\excludecomment{CCSXML}

% New concepts scheme
\let\@concepts\@empty
%
% The first argument is the significance, the
% second is the concept(s)
%
\newcommand\ccsdesc[2][100]{%
  \ccsdesc@parse#1~#2~}
%
% The parser of the expression Significance~General~Specific
%
\def\ccsdesc@parse#1~#2~#3~{%
  \expandafter\ifx\csname CCS@#2\endcsname\relax
    \expandafter\gdef\csname CCS@#2\endcsname{\textbullet\textbf{#2} $\to$ }%
  \g@addto@macro{\@concepts}{\csname CCS@#2\endcsname}\fi
  \expandafter\g@addto@macro\expandafter{\csname CCS@#2\endcsname}{%
    \ifnum#1>499\textbf{#3; }\else
    \ifnum#1>299\textit{#3; }\else
    #3; \fi\fi}}



\newenvironment{ackslike}[1]
  {\par \footnotesize 
   \@ucheadfalse
   \@startsection{subsection}{2}{\z@}{-16pt plus -2pt minus -1pt}{2pt}{\sf}*
   {\uppercase{#1}}\par\normalsize
        }
  {\par}
\newenvironment{acks}{\begin{ackslike}{ACKNOWLEDGMENTS}}{\end{ackslike}}
%
\mark{{}{}} 
\def\bull{{\fontsize{7}{7}\selectfont\raise1.6pt\hbox{$\bullet$}}}
\def\ps@myheadings{\let\@mkboth\@gobbletwo
\def\@oddhead{\hbox{}\hfill \small\sf \rightmark\hskip 19pt{\bull}\hskip 17pt\thepage}
\def\@oddfoot{\hbox{}\hfill\tiny\@runningfoot}
\def\@evenhead{\small\sf\thepage \hskip 17pt{\bull}\hskip 19pt\leftmark\hfill \hbox{}}
\def\@evenfoot{\tiny\@runningfoot\hfill\hbox{}}
\def\sectionmark##1{}\def\subsectionmark##1{}}
%
\def\acmArticleNum#1{\def\@acmArticleNum{#1}}
\def\@runningfoot{}
\def\runningfoot{\def\@runningfoot{\@journalName, Vol.\ \@acmVolume, No.\ \@acmNumber, Article\ \@acmArticleNum, Publication date:\ \@acmMonth\ \@acmYear.}}
\def\@firstfoot{}
\def\firstfoot{\def\@firstfoot{\@journalName, Vol.\ \@acmVolume, No.\ \@acmNumber, Article\ \@acmArticleNum, Publication date:\ \@acmMonth\ \@acmYear.}}
\def\ps@titlepage{\let\@mkboth\@gobbletwo
\def\@oddhead{}\def\@oddfoot{\hbox{}\hfill
\scriptsize\@firstfoot}\def\@evenhead{}\def\@evenfoot{\scriptsize\@firstfoot\hfill\hbox{}}}
%
\def\today{\ifcase\month\or
 January\or February\or March\or April\or May\or June\or
 July\or August\or September\or October\or November\or December\fi
 \space\number\day, \number\year}
\def\@marrayclassiv{\@addtopreamble{$\displaystyle \@nextchar$}}
\def\@marrayclassz{\ifcase \@lastchclass \@acolampacol \or \@ampacol \or
 \or \or \@addamp \or
 \@acolampacol \or \@firstampfalse \@acol \fi
\edef\@preamble{\@preamble
 \ifcase \@chnum 
 \hfil$\relax\displaystyle\@sharp$\hfil \or $\relax\displaystyle\@sharp$\hfil 
 \or \hfil$\relax\displaystyle\@sharp$\fi}}
\def\marray{\arraycolsep 2.5pt\let\@acol\@arrayacol \let\@classz\@marrayclassz
 \let\@classiv\@marrayclassiv \let\\\@arraycr\def\@halignto{}\@tabarray}
\def\endmarray{\crcr\egroup\egroup}
%
\ps@myheadings \pagenumbering{arabic} \onecolumn 
%
\def\@biblabel#1{}
%
% -------------------------------------------------------------------------
%
% Citation macros (compatible with natbib package).
%
\AtBeginDocument{%
\@ifpackageloaded{natbib}{% Natbib loaded
\renewcommand\bibsection{%
   \section*{\footnotesize\sf{REFERENCES}\@mkboth
  {\uppercase{\refname}}{\uppercase{\refname}}}%
}%
\bibpunct[, ]{[}{]}{;}{a}{}{,}
\let\citeN\cite
\let\cite\citep
\let\citeANP\citeauthor
\let\citeNN\citeyearpar
\let\citeyearNP\citeyear
\let\citeyear\citeyearpar
\let\citeNP\citealt
\def\shortcite#1{\citeyear{#1}}
\DeclareRobustCommand\citeA
   {\begingroup\NAT@swafalse\let\NAT@ctype\@ne\NAT@partrue\NAT@fullfalse\NAT@open\NAT@citetp}
\newcommand\newblock{}
}{% Natbib not loaded
\let\@internalcite\cite

\def\cite{\def\@citeseppen{-1000}%
    \def\@cite##1##2{[##1\if@tempswa , ##2\fi]}%
    \def\citeauthoryear##1##2##3{##2 ##3}\@internalcite}
\def\citeXNP#1#2{%
  \def\@cite@label{#2}%
  \def\@cite##1##2{##1\if@tempswa , ##2\fi}%
  \def\citeauthoryear##1##2##3{\@cite@label}\@internalcite{#1}}
% \def\@citeseppen{-1000}%
%    \def\@cite@label{#1}
%    \def\@cite##1##2{\if@tempswa ##2\fi}%
%    \def\citeauthoryear##1##2##3{##2 ##3}\@internalcite}
\def\citeNP{\def\@citeseppen{-1000}%
    \def\@cite##1##2{##1\if@tempswa , ##2\fi}%
    \def\citeauthoryear##1##2##3{##2 ##3}\@internalcite}
\def\citeN{\def\@citeseppen{-1000}%
    \def\@cite##1##2{##1\if@tempswa , ##2]\else{]}\fi}%
    \def\citeauthoryear##1##2##3{##2 [##3}\@citedata}
\def\shortcite#1{\citeyear{#1}}
\def\citeS#1{[\citeANP{#1} \citeyearNP{#1}]}
\def\citeNS#1{\citeANP{#1} \citeyear{#1}}
\def\citeNPS#1{\citeANP{#1} \citeyearNP{#1}}
%testing year,year
\def\citeNN{\def\@citeseppen{-1000}%
    \def\@cite##1##2{[##1\if@tempswa , ##2\fi]}%
    \def\citeauthoryear##1##2##3{##3}\@citedata}

\def\citeA{\def\@citeseppen{-1000}%
    \def\@cite##1##2{[##1\if@tempswa , ##2\fi]}%
    \def\citeauthoryear##1##2##3{##2}\@internalcite}
\def\citeANP{\def\@citeseppen{-1000}%
    \def\@cite##1##2{##1\if@tempswa , ##2\fi}%
    \def\citeauthoryear##1##2##3{##2}\@internalcite}

\def\citeyear{\def\@citeseppen{-1000}%
    \def\@cite##1##2{[##1\if@tempswa , ##2\fi]}%
    \def\citeauthoryear##1##2##3{##3}\@citedata}
\def\citeyearNP{\def\@citeseppen{-1000}%
    \def\@cite##1##2{##1\if@tempswa , ##2\fi}%
    \def\citeauthoryear##1##2##3{##3}\@citedata}

%
% \@citedata and \@citedatax:
%
% Place commas in-between citations in the same \citeyear, \citeyearNP,
% or \citeN command.
% Use something like \citeN{ref1,ref2,ref3} and \citeN{ref4} for a list.
%
\def\@citedata{%
        \@ifnextchar [{\@tempswatrue\@citedatax}%
                                  {\@tempswafalse\@citedatax[]}%
}

\def\@citedatax[#1]#2{%
\if@filesw\immediate\write\@auxout{\string\citation{#2}}\fi%
  \def\@citea{}\@cite{\@for\@citeb:=#2\do%
    {\@citea\def\@citea{; }\@ifundefined% by Young
       {b@\@citeb}{{\bf ?}%
       \@warning{Citation `\@citeb' on page \thepage \space undefined}}%
{\csname b@\@citeb\endcsname}}}{#1}}%

% don't box citations, separate with ; and a space
% also, make the penalty between citations negative: a good place to break.
%
\def\@citex[#1]#2{%
\if@filesw\immediate\write\@auxout{\string\citation{#2}}\fi%
  \def\@citea{}\@cite{\@for\@citeb:=#2\do%
    {\@citea\def\@citea{; }\@ifundefined% by Young
       {b@\@citeb}{{\bf ?}%
       \@warning{Citation `\@citeb' on page \thepage \space undefined}}%
{\csname b@\@citeb\endcsname}}}{#1}}%

% Fix cite so it doesn't repeat author lists in citations:

\def\cite{\def\@citeseppen{-1000}%
    \def\@cite##1##2{[##1\if@tempswa , ##2\fi]}%
    \let\@lastauthor=\@noauthor
    \let\citeauthoryear=\citeauthoryear@no@repeats\@internalcite}
    %\def\citeauthoryear##1##2##3{##2 ##3}\@internalcite

\def\@noauthor={\relax}
\let\@lastauthor=\@noauthor
\let\@currauthor=\@noauthor

\def\citeauthoryear@no@repeats#1#2#3{%
  \def\@currauthor{\csname @author #1\endcsname}%
  \ifx\@lastauthor\@currauthor{#3}\else{#2 #3}\fi%
  \let\@lastauthor=\@currauthor}
  \newlength{\bibhang}
  \setlength{\bibhang}{2em}
}}


\newdimen\bibindent
\bibindent=.8em
\@ifundefined{refname}%
   {\@ifundefined{chapter}%
     {\newcommand{\refname}{\footnotesize REFERENCES}}%
     {\newcommand{\refname}{\footnotesize BIBLIOGRAPHY}}%
   }%
   {}%
%
\def\newdef#1{\@ifnextchar[{\@xnewdef{#1}}{\@ynewdef{#1}}}
\def\@xnewdef#1[#2]#3{\newtheorem{italic@#1}[#2]{{\em #3}}\@newdef{#1}}
\def\@ynewdef#1#2{\@ifnextchar[{\@xynewdef{#1}{#2}}{\@yynewdef{#1}{#2}}}
\def\@xynewdef#1#2[#3]{\newtheorem{italic@#1}{{\em #2}}[#3]\@newdef{#1}}
\def\@yynewdef#1#2{\newtheorem{italic@#1}{{\em #2}}\@newdef{#1}}
\def\@newdef#1{\newenvironment{#1}{\@ifnextchar[{\@xstartdef{#1}}{\@ystartdef{#1}}}{\end{italic@#1}}}
\def\@xstartdef#1[#2]{\begin{italic@#1}[{\em #2}]\rm}
\def\@ystartdef#1{\begin{italic@#1}\rm}
\def\@oddfoot{\hbox{}\hfill\scriptsize\@runningfoot}
\def\@evenfoot{\scriptsize\@runningfoot\hfill\hbox{}}
\def\firstfootsize{\@setsize\firstfootsize{7pt}\vipt\@vipt}
\def\ps@titlepage{\let\@mkboth\@gobbletwo
\def\@oddhead{}\def\@oddfoot{\hbox{}\hfill\firstfootsize\@firstfoot}%
\def\@evenhead{}\def\@evenfoot{\firstfootsize\@firstfoot\hfill\hbox{}}}
%
\def\@listI{\leftmargin\leftmargini
 \labelwidth\leftmargini\advance\labelwidth-\labelsep
 \parsep 0pt plus 1pt
 \topsep 6pt plus 2pt minus 2pt
 \itemsep 2pt plus 1pt minus .5pt}
\let\@listi\@listI
\@listi 
%
\def\longenum{\ifnum \@enumdepth >3 \@toodeep\else
 \advance\@enumdepth \@ne 
 \edef\@enumctr{enum\romannumeral\the\@enumdepth}\list
 {\csname label\@enumctr\endcsname}{\usecounter
 {\@enumctr}\labelwidth\z@\leftmargin\z@
 \itemindent\parindent \advance\itemindent\labelsep}\fi}
%
\def\ack{ \par \footnotesize 
\@ucheadfalse
\@startsection{subsection}{2}{\z@}{-16pt plus -2pt minus 
 -1pt}{2pt}{\sf}*{ACKNOWLEDGMENT}\par\normalsize
}
\def\endack{\par}

% provide both spellings of Acknowledgment(s)
\let\acknowledgments\acks
\let\endacknowledgments\endacks
\let\acknowledgment\ack
\let\endacknowledgment\endack
%
\newcommand{\bibemph}[1]{{\em#1}}
\newcommand{\bibemphic}[1]{{\em#1\/}}
\newcommand{\bibsc}[1]{{\sc#1}}

\newcommand\bibyear[2]{%
    \unskip{\hskip8pt}\ignorespaces#1\unskip
    \if..#2{\hskip6pt}\else {\hskip8pt}#2 \fi
}
%
\def\thebibliography#1{
  \footnotesize\section*{\footnotesize\sf{REFERENCES}\@mkboth
  {\uppercase{\refname}}{\uppercase{\refname}}}%
   \list
  {\@biblabel{\arabic{enumiv}}}{%
   %\settowidth\labelwidth{[#1]}
   \labelwidth 0pt
   \leftmargin \bibindent
   \labelsep 0pt
   \itemindent -\bibindent %%%FBU
   \listparindent -\bibindent
   \labelsep -\bibindent
    \usecounter{enumiv}%
    \let\p@enumiv\@empty
    \def\theenumiv{\arabic{enumiv}}}%
    \def\newblock{\hskip .11em plus.33em minus.07em}%
    \sloppy
    \clubpenalty=4500
    \widowpenalty=4500
    \frenchspacing}
\def\endthebibliography{%
  \def\@noitemerr{\@warning{Empty `thebibliography' environment}}%
  \endlist}
\def\@lbibitem[#1]#2{\item[]\if@filesw
      {\def\protect##1{\string ##1\space}\immediate
       \write\@auxout{\string\bibcite{#2}{#1}}}\fi\ignorespaces}  %%\hskip-1em FBU
%
\DeclareOldFontCommand{\rm}{\normalfont\rmfamily}{\mathrm}
\DeclareOldFontCommand{\sf}{\normalfont\sffamily}{\mathsf}
\DeclareOldFontCommand{\tt}{\normalfont\ttfamily}{\mathtt}
\DeclareOldFontCommand{\bf}{\normalfont\bfseries}{\mathbf}
\DeclareOldFontCommand{\it}{\normalfont\itshape}{\mathit}
\DeclareOldFontCommand{\sl}{\normalfont\slshape}{\@nomath\sl}
\DeclareOldFontCommand{\sc}{\normalfont\scshape}{\@nomath\sc}
\DeclareRobustCommand*\cal{\@fontswitch\relax\mathcal}
\DeclareRobustCommand*\mit{\@fontswitch\relax\mathnormal}
%
\def\@acmformat{}
\def\acmformat#1{\gdef\@acmformat{\noindent{\bf ACM Reference Format:}\\[2pt] #1\par}}
%
\def\received#1#2{%
    \par%
    \tiny
    \addvspace{12\p@}%
    \parindent\z@%
\small\scriptsize{Received\ #1;\   accepted\ #2}%
\par%
}

%
\sloppy
\clubpenalty10000
\widowpenalty10000%
\@lowpenalty   51
\@medpenalty  151
\@highpenalty 301
%
\@beginparpenalty -\@lowpenalty
\@endparpenalty   -\@lowpenalty
\@itempenalty     -\@lowpenalty

\voffset-5pc
\hoffset-6.03pc

\usepackage{times}
%% \usepackage[mtbold]{mathtime}
\usepackage{bm}
\usepackage{graphicx}% Include figure files
\renewcommand{\ttdefault}{cmtt}

\endinput

% end of acmtog.cls  Version 1.2 - March 2012

