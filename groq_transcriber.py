# bot_29-main/groq_transcriber.py

import os
import asyncio
from groq import Groq
from logger_config import logger

def format_timestamp(seconds: float) -> str:
    """Форматирует секунды в строку HH:MM:SS.ms."""
    if seconds is None:
        return "00:00:00.000"
    
    milliseconds = int((seconds - int(seconds)) * 1000)
    minutes, seconds = divmod(int(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}"

async def transcribe_audio_file(filepath: str):
    """
    Отправляет аудиофайл в Groq API для транскрипции и сохраняет результат.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        logger.error("[Groq] GROQ_API_KEY не найден в переменных окружения. Транскрипция отменена.")
        return

    if not os.path.exists(filepath):
        logger.error(f"[Groq] Файл для транскрипции не найден: {filepath}")
        return

    logger.info(f"[Groq] Начало транскрипции файла: {os.path.basename(filepath)}")

    try:
        client = Groq(api_key=api_key)
        
        with open(filepath, "rb") as audio_file:
            transcription = await asyncio.to_thread(
                client.audio.transcriptions.create,
                file=(os.path.basename(filepath), audio_file.read()),
                model="whisper-large-v3",
                response_format="verbose_json",
                timestamp_granularities=["segment"]
            )

        logger.info(f"[Groq] Получен ответ от API для файла {os.path.basename(filepath)}. Форматирование...")

        # Форматируем результат с временными метками
        formatted_text = ""
        if transcription.segments:
            for segment in transcription.segments:
                start_time = format_timestamp(segment.start)
                end_time = format_timestamp(segment.end)
                formatted_text += f"[{start_time} --> {end_time}] {segment.text.strip()}\n"
        else:
            formatted_text = transcription.text

        # Сохраняем результат в .txt файл
        txt_filepath = os.path.splitext(filepath)[0] + ".txt"
        with open(txt_filepath, "w", encoding="utf-8") as txt_file:
            txt_file.write(formatted_text)

        logger.info(f"[Groq] Транскрипция успешно сохранена в файл: {os.path.basename(txt_filepath)}")

    except Exception as e:
        logger.error(f"[Groq] Ошибка во время транскрипции файла {os.path.basename(filepath)}: {e}")