
import os
from pydub import AudioSegment
from typing import List, Dict, Any
from logger_config import logger
import database

RECORDS_DIR = "call_records"
MERGED_DIR = os.path.join(RECORDS_DIR, "merged")

async def process_and_merge_recordings(recording_pair: List[Dict[str, Any]]):
    """
    Основная функция для обработки и сведения двух аудиозаписей.
    Сохраняет исходный формат (webm/opus) и частоту дискретизации.
    """
    try:
        os.makedirs(MERGED_DIR, exist_ok=True)

        record1_data = recording_pair[0]
        record2_data = recording_pair[1]

        # 1. Загружаем аудиофайлы
        logger.info(f"Загрузка аудиофайлов: {record1_data['file_path']} и {record2_data['file_path']}")
        audio1 = AudioSegment.from_file(record1_data['file_path'], format="webm")
        audio2 = AudioSegment.from_file(record2_data['file_path'], format="webm")

        # 2. Определяем, какая запись началась раньше
        if record1_data['start_timestamp_ms'] <= record2_data['start_timestamp_ms']:
            earlier_audio = audio1
            later_audio = audio2
            time_diff_ms = record2_data['start_timestamp_ms'] - record1_data['start_timestamp_ms']
        else:
            earlier_audio = audio2
            later_audio = audio1
            time_diff_ms = record1_data['start_timestamp_ms'] - record2_data['start_timestamp_ms']
        
        logger.info(f"Разница во времени старта записей: {time_diff_ms} мс.")

        # 3. Создаем тишину и добавляем ее к более ранней записи для синхронизации
        if time_diff_ms > 0:
            silence = AudioSegment.silent(duration=time_diff_ms)
            earlier_audio = silence + earlier_audio

        # 4. Накладываем (микшируем) дорожки
        # Убедимся, что обе дорожки имеют одинаковую длину для overlay
        if len(earlier_audio) > len(later_audio):
            silence_for_later = AudioSegment.silent(duration=len(earlier_audio) - len(later_audio))
            later_audio += silence_for_later
        elif len(later_audio) > len(earlier_audio):
            silence_for_earlier = AudioSegment.silent(duration=len(later_audio) - len(earlier_audio))
            earlier_audio += silence_for_earlier

        merged_audio = earlier_audio.overlay(later_audio)

        # 5. Конвертируем в моно, как и планировалось для транскрипции
        merged_audio = merged_audio.set_channels(1)

        # 6. Сохраняем результат в исходном формате
        base_filename = os.path.basename(record1_data['file_path']).split('_')[1]
        merged_filename = f"merged_dialog_{base_filename}.webm"
        merged_filepath = os.path.join(MERGED_DIR, merged_filename)
        
        # Экспортируем в формате webm с кодеком opus, сохраняя исходные параметры
        merged_audio.export(merged_filepath, format="webm", codec="libopus")
        logger.info(f"Сведенный аудиофайл сохранен: {merged_filepath}")

        # 7. Обновляем статус в БД
        recording_ids = [rec['recording_id'] for rec in recording_pair]
        await database.mark_recordings_as_processed(recording_ids, merged_filepath)
        logger.info(f"Записи {recording_ids} помечены как обработанные.")

    except Exception as e:
        logger.error(f"Критическая ошибка при сведении аудиофайлов: {e}")
        # Здесь можно добавить логику для повторной попытки или уведомления администратора