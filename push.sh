#!/bin/bash
# むーん LP デプロイスクリプト
# 使い方: bash push.sh "更新内容のメモ"

MSG="${1:-update}"
cd "$(dirname "$0")"

git add .
git commit -m "$MSG"
git push origin main

echo "✅ GitHub push 完了"
echo "🌐 Cloudflare Pages が自動デプロイ開始します"
