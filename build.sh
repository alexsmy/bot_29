#!/usr/bin/env bash
# Устанавливаем строгий режим. Скрипт завершится, если какая-либо команда завершится с ошибкой.
set -e

echo "--- Build script started ---"

# Шаг 1: Обновляем список пакетов и устанавливаем FFmpeg
# Флаг -y автоматически подтверждает установку.
echo "INFO: Updating packages and installing FFmpeg..."
apt-get update -y && apt-get install -y ffmpeg

# Шаг 2: Устанавливаем зависимости Python из requirements.txt
echo "INFO: Installing Python dependencies..."
pip install -r requirements.txt

echo "--- Build script finished successfully ---"