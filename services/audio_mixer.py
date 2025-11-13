import os
import glob
import asyncio
from pydub import AudioSegment
from logger_config import logger

async def mix_audio_for_room(directory: str, room_id: str):
    """
    Находит два аудиофайла для указанной комнаты, синхронизирует их по времени,
    микширует в один и удаляет исходные файлы.
    """
    try:
        # Даем небольшую паузу, чтобы второй файл успел полностью записаться на диск
        await asyncio.sleep(2)

        safe_room_id = "".join(c for c in room_id if c.isalnum() or c in ('-', '_'))
        search_pattern = os.path.join(directory, f"*_{safe_room_id[:8]}_*.webm")
        files = glob.glob(search_pattern)

        # Ищем только файлы, которые еще не являются диалогами
        source_files = [f for f in files if "dialogue" not in os.path.basename(f)]

        if len(source_files) < 2:
            logger.info(f"Найдено {len(source_files)}/2 файлов для комнаты {room_id}. Микширование отложено.")
            return

        if len(source_files) > 2:
            logger.warning(f"Найдено более 2 файлов для комнаты {room_id}: {source_files}. Будут использованы первые два.")
            source_files = source_files[:2]

        logger.info(f"Начинаем микширование для комнаты {room_id}. Файлы: {source_files}")

        # 1. Парсим имена файлов, чтобы извлечь временные метки
        file_data = []
        for f_path in source_files:
            try:
                basename = os.path.basename(f_path)
                # Формат: {timestamp}_{room_id}_{user_id}_{recording_start_time}.webm
                start_time_ms = int(basename.split('_')[-1].split('.')[0])
                file_data.append({'path': f_path, 'start_time': start_time_ms})
            except (IndexError, ValueError) as e:
                logger.error(f"Не удалось распарсить имя файла {f_path}: {e}")
                return

        # 2. Определяем, какой файл начался раньше
        file_data.sort(key=lambda x: x['start_time'])
        file1_data = file_data[0]  # Начался раньше
        file2_data = file_data[1]  # Начался позже

        # 3. Вычисляем смещение
        offset_ms = file2_data['start_time'] - file1_data['start_time']
        logger.info(f"Смещение между записями: {offset_ms} мс.")

        # 4. Загружаем аудио с помощью pydub
        audio1 = AudioSegment.from_file(file1_data['path'], format="webm")
        audio2 = AudioSegment.from_file(file2_data['path'], format="webm")

        # 5. Создаем тишину и добавляем ее к первому (раннему) файлу
        silence = AudioSegment.silent(duration=offset_ms)
        audio1_aligned = silence + audio1

        # 6. Накладываем второй файл на выровненный первый
        # Убедимся, что итоговая длина равна самому длинному треку
        if len(audio1_aligned) > len(audio2):
            mixed_audio = audio1_aligned.overlay(audio2)
        else:
            # Если второй файл (с учетом сдвига) длиннее, он становится основой
            mixed_audio = audio2.overlay(audio1_aligned)

        # 7. Сохраняем результат
        output_basename = f"{os.path.basename(file1_data['path']).split('_')[0]}_{safe_room_id[:8]}_dialogue.webm"
        output_path = os.path.join(directory, output_basename)
        
        # Экспортируем с теми же параметрами (кодек opus используется по умолчанию для webm в pydub)
        mixed_audio.export(output_path, format="webm")
        logger.info(f"Микшированный файл успешно сохранен: {output_path}")

        # 8. Удаляем исходные файлы
        try:
            os.remove(file1_data['path'])
            os.remove(file2_data['path'])
            logger.info(f"Исходные файлы для комнаты {room_id} удалены.")
        except OSError as e:
            logger.error(f"Ошибка при удалении исходных файлов для комнаты {room_id}: {e}")

    except Exception as e:
        logger.error(f"Критическая ошибка в процессе микширования для комнаты {room_id}: {e}")