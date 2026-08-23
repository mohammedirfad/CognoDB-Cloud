#!/usr/bin/env bash
set -euo pipefail

echo "==> Preparing dataset"
npm run dataset:prepare

echo "==> Loading dataset into every configured platform"
npm run bench:load

echo "==> Running full benchmark suite"
npm run bench:run

echo "==> Generating results/RESULTS.md"
npm run bench:report

echo "==> Done. See results/RESULTS.md"
