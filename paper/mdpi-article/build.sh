#!/usr/bin/env bash
# Build the MDPI Computers submission PDF.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f Definitions/logo-mdpi-eps-converted-to.pdf ]; then
  epstopdf --outfile=Definitions/logo-mdpi-eps-converted-to.pdf Definitions/logo-mdpi.eps
fi

pdflatex -interaction=nonstopmode main.tex > /dev/null
pdflatex -interaction=nonstopmode main.tex > /dev/null

echo "built main.pdf"
pdfinfo main.pdf | grep -E "^Pages|^Page size"
