#!/usr/bin/env bash
# exit on error
set -o errexit

# 1. Устанавливаем FFmpeg
# apt-get update - обновляет список доступных пакетов
# apt-get install -y ffmpeg - устанавливает ffmpeg, флаг -y автоматически отвечает "yes" на все запросы
echo "Updating packages and installing FFmpeg..."
apt-get update && apt-get install -y ffmpeg

# 2. Устанавливаем зависимости Python
# Это ВАЖНО! Когда вы создаете build.sh, Render передает вам управление сборкой.
# Поэтому нужно явно указать команду для установки пакетов из requirements.txt.
echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Build script finished successfully."