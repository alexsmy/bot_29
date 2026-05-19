from __future__ import annotations

from aiogram.filters.callback_data import CallbackData


class HubCB(CallbackData, prefix="hub"):
    action: str


class SupportCB(CallbackData, prefix="support"):
    action: str
    target_id: str = ""
    value: str = ""


class FileVaultCB(CallbackData, prefix="fv"):
    action: str
    folder_id: str = ""
    file_id: str = ""
    page: int = 0


class CryptoCB(CallbackData, prefix="crypto"):
    action: str
    section: str = ""


class TimeCB(CallbackData, prefix="time"):
    action: str = "show"


class NoopCB(CallbackData, prefix="noop"):
    action: str = "ok"
