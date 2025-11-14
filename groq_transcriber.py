import os
import asyncio
import glob
from groq import Groq
from logger_config import logger
import notifier

RECORDS_DIR = "call_records"

def format_timestamp(seconds: float) -> str:
    if seconds is None:
        return "00:00:00.000"
    
    milliseconds = int((seconds - int(seconds)) * 1000)
    minutes, seconds = divmod(int(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}"

async def summarize_dialogue(dialogue_filepath: str):
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        logger.error("[Groq] GROQ_API_KEY не найден. Создание пересказа отменено.")
        return

    logger.info(f"[Groq] Начало создания краткого пересказа для файла: {os.path.basename(dialogue_filepath)}")

    try:
        with open(dialogue_filepath, "r", encoding="utf-8") as f:
            dialogue_content = f.read()

        prompt = (
            "Твоя задача - составить краткий, но содержательный пересказ диалога. "
            "Определи основные темы, которые обсуждали собеседники, и ключевые моменты разговора. "
            "Ответ должен быть только в виде текста пересказа, без каких-либо вступлений, заголовков или пояснений."
            "\n\nВот текст диалога для анализа:\n"
            f"{dialogue_content}"
        )

        client = Groq(api_key=api_key)
        
        chat_completion = await asyncio.to_thread(
            client.chat.completions.create,
            messages=[{"role": "user", "content": prompt}],
            model="openai/gpt-oss-120b",
            temperature=0.1,
            max_tokens=8192,
            top_p=1,
            stream=False
        )

        summary_text = chat_completion.choices[0].message.content.strip()
        
        output_filepath = os.path.splitext(dialogue_filepath)[0].replace('_dialog', '_resume') + ".txt"

        with open(output_filepath, "w", encoding="utf-8") as out_file:
            out_file.write(summary_text)

        logger.info(f"[Groq] Краткий пересказ успешно создан и сохранен в файл: {os.path.basename(output_filepath)}")
        
        message_to_admin = f"📄 <b>Краткий пересказ звонка</b>\n\n<b>Сессия:</b> <code>{os.path.basename(output_filepath)}</code>"
        await notifier.send_notification_with_content_handling(
            message=message_to_admin,
            file_path=output_filepath,
            setting_key_file='notify_on_summary_as_file',
            setting_key_message='notify_on_summary_as_message'
        )

    except FileNotFoundError:
        logger.error(f"[Groq] Файл диалога для создания пересказа не найден: {dialogue_filepath}")
    except Exception as e:
        logger.error(f"[Groq] Ошибка во время создания краткого пересказа: {e}")


async def merge_transcriptions_to_dialogue(file1_path: str, file2_path: str):
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        logger.error("[Groq] GROQ_API_KEY не найден. Слияние диалога отменено.")
        return

    logger.info(f"[Groq] Начало слияния диалога из файлов: {os.path.basename(file1_path)} и {os.path.basename(file2_path)}")

    try:
        with open(file1_path, "r", encoding="utf-8") as f1, open(file2_path, "r", encoding="utf-8") as f2:
            content1 = f1.read()
            content2 = f2.read()

        prompt = (
            "Проанализируй две части диалога. Каждая часть содержит транскипцию разговора одного из собеседников. "
            "Диалог имеет метки времени, чтобы можно было определить, кто именно говорит.\n"
            "Твоя задача - превратить две форматированные части диалога в обычный диалог, восстановив кто за кем говорил, используя временные метки. "
            "В ответе должен быть только сам диалог, без заголовков и лишних пояснений. Каждую реплику начинай с 'Собеседник 1:' или 'Собеседник 2:'."
            "\n\nВот тексты:\n"
            f"{content1}\n===\n{content2}"
        )

        client = Groq(api_key=api_key)
        
        chat_completion = await asyncio.to_thread(
            client.chat.completions.create,
            messages=[{"role": "user", "content": prompt}],
            model="openai/gpt-oss-120b",
            temperature=0.1,
            max_tokens=8192,
            top_p=1,
            stream=False
        )

        dialogue_text = chat_completion.choices[0].message.content.strip()
        
        base_name_parts = os.path.basename(file1_path).split('_')
        date_part = base_name_parts[0]
        room_id_part = base_name_parts[1] # ИСПРАВЛЕНО: Индекс room_id был неверным
        output_filename = f"{date_part}_{room_id_part}_dialog.txt"
        output_filepath = os.path.join(RECORDS_DIR, output_filename)

        with open(output_filepath, "w", encoding="utf-8") as out_file:
            out_file.write(dialogue_text)

        logger.info(f"[Groq] Диалог успешно собран и сохранен в файл: {output_filename}")
        
        message_to_admin = f"💬 <b>Диалог звонка</b>\n\n<b>Сессия:</b> <code>{output_filename}</code>"
        await notifier.send_notification_with_content_handling(
            message=message_to_admin,
            file_path=output_filepath,
            setting_key_file='notify_on_dialog_as_file',
            setting_key_message='notify_on_dialog_as_message'
        )
        
        # ИСПРАВЛЕНИЕ: Переименовываем обработанные файлы, чтобы они не мешали следующим звонкам
        try:
            os.rename(file1_path, file1_path + ".processed")
            os.rename(file2_path, file2_path + ".processed")
            logger.info(f"[Groq] Исходные файлы транскрипции переименованы в *.processed")
        except OSError as e:
            logger.error(f"[Groq] Не удалось переименовать обработанные файлы: {e}")

        asyncio.create_task(summarize_dialogue(output_filepath))

    except FileNotFoundError as e:
        logger.error(f"[Groq] Один из файлов для слияния не найден: {e}")
    except Exception as e:
        logger.error(f"[Groq] Ошибка во время слияния диалога: {e}")


async def transcribe_audio_file(filepath: str):
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
                temperature=0,
                language="ru",
                response_format="verbose_json",
                timestamp_granularities=["segment"]
            )

        logger.info(f"[Groq] Получен ответ от API для файла {os.path.basename(filepath)}. Форматирование...")

        formatted_text = ""
        if transcription.segments:
            for segment in transcription.segments:
                start_time = format_timestamp(segment['start'])
                end_time = format_timestamp(segment['end'])
                text = segment['text'].strip()
                formatted_text += f"[{start_time} --> {end_time}] {text}\n"
        else:
            formatted_text = transcription.text

        txt_filepath = os.path.splitext(filepath)[0] + ".txt"
        with open(txt_filepath, "w", encoding="utf-8") as txt_file:
            txt_file.write(formatted_text)

        logger.info(f"[Groq] Транскрипция успешно сохранена в файл: {os.path.basename(txt_filepath)}")

        base_name_parts = os.path.basename(txt_filepath).split('_')
        if len(base_name_parts) < 3:
            logger.warning(f"[Groq] Некорректное имя файла для поиска пары: {txt_filepath}")
            return
            
        room_id = base_name_parts[1] # ИСПРАВЛЕНО: Индекс room_id был неверным
        
        search_pattern = os.path.join(RECORDS_DIR, f"*_{room_id}_*.txt")
        all_txt_files = glob.glob(search_pattern)
        
        # ИСПРАВЛЕНИЕ: Фильтруем также файлы, которые уже были обработаны
        participant_txt_files = [
            f for f in all_txt_files 
            if not f.endswith('_dialog.txt') 
            and not f.endswith('_resume.txt')
            and not f.endswith('.processed')
        ]

        if len(participant_txt_files) == 2:
            logger.info(f"[Groq] Обнаружены обе транскрипции для сессии с room_id {room_id}. Запускаю слияние.")
            asyncio.create_task(merge_transcriptions_to_dialogue(participant_txt_files[0], participant_txt_files[1]))

    except Exception as e:
        logger.error(f"[Groq] Ошибка во время транскрипции файла {os.path.basename(filepath)}: {e}")