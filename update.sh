#!/bin/bash
set -e

echo "🔄 更新代码..."
git fetch --all
git reset --hard origin/main

echo "📦 安装依赖..."
npm install

echo "🚀 重启 PM2 进程..."
pm2 restart whatsapp-bot || pm2 start index.js --name whatsapp-bot

echo "💾 保存 PM2 配置..."
pm2 save

echo "🧹 清理 PM2 日志..."
pm2 flush

echo "✅ 更新完成！"
