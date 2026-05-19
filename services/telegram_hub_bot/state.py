from __future__ import annotations

from aiogram.fsm.state import State, StatesGroup


class SupportStates(StatesGroup):
    waiting_pin = State()
    waiting_target_create = State()
    waiting_target_url = State()
    waiting_interval = State()
    waiting_target_rename = State()


class FileVaultStates(StatesGroup):
    waiting_folder_create = State()
    waiting_folder_rename = State()
    waiting_file_rename = State()
    waiting_upload = State()
