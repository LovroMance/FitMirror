#!/bin/bash
# FitMirror 初始化脚本
# 用于一键安装依赖、初始化环境

echo "[FitMirror] 初始化开始..."

# 前端依赖安装
cd ../frontend
npm install

# 后端依赖安装
cd ../backend
npm install

echo "[FitMirror] 初始化完成。"
