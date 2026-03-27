"""
M365 Email Connector — interactive demo CLI.

Usage:
    cp .env.example .env        # fill in AZURE_TENANT_ID and AZURE_CLIENT_ID
    pip install -r requirements.txt
    python main.py
"""

import os
from datetime import datetime, timedelta

from dotenv import load_dotenv

from connector import M365Auth, CalendarConnector, FolderConnector, MailConnector


def print_section(title: str) -> None:
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print("=" * 60)


def demo_mail(mail: MailConnector) -> None:
    print_section("Inbox (latest 5 messages)")
    messages = mail.list_messages(
        folder="inbox",
        top=5,
        select=["subject", "from", "receivedDateTime", "isRead"],
    )
    if not messages:
        print("  No messages found.")
    for msg in messages:
        read_flag = "" if msg.get("isRead") else "[UNREAD] "
        sender = msg.get("from", {}).get("emailAddress", {}).get("address", "unknown")
        print(f"  {read_flag}{msg['subject'][:60]}  |  {sender}  |  {msg['receivedDateTime'][:10]}")

    print_section("Search: messages containing 'invoice'")
    results = mail.search_messages("invoice", top=3)
    if not results:
        print("  No results.")
    for r in results:
        print(f"  {r['subject'][:70]}")


def demo_folders(folders: FolderConnector) -> None:
    print_section("Mail Folders")
    for folder in folders.list_folders():
        counts = folders.get_folder_message_count(folder["id"])
        print(f"  {folder['displayName']:30s}  total={counts['total']}  unread={counts['unread']}")


def demo_calendar(cal: CalendarConnector) -> None:
    print_section("Calendars")
    for calendar in cal.list_calendars():
        print(f"  {calendar['name']}  ({calendar['id'][:8]}…)")

    now = datetime.utcnow()
    week_later = now + timedelta(days=7)
    print_section(f"Events — next 7 days ({now.date()} → {week_later.date()})")
    events = cal.get_schedule_view(start=now, end=week_later)
    if not events:
        print("  No events found.")
    for ev in events:
        start = ev.get("start", {}).get("dateTime", "")[:16].replace("T", " ")
        print(f"  {start}  {ev['subject'][:60]}")


def main() -> None:
    load_dotenv()

    tenant_id = os.environ.get("AZURE_TENANT_ID")
    client_id = os.environ.get("AZURE_CLIENT_ID")

    if not tenant_id or not client_id:
        raise EnvironmentError(
            "AZURE_TENANT_ID and AZURE_CLIENT_ID must be set in your .env file.\n"
            "See .env.example for instructions."
        )

    print("Authenticating with Microsoft 365…")
    auth = M365Auth(tenant_id=tenant_id, client_id=client_id)

    mail = MailConnector(auth)
    folders = FolderConnector(auth)
    cal = CalendarConnector(auth)

    # --- Run demos ---
    demo_mail(mail)
    demo_folders(folders)
    demo_calendar(cal)

    print_section("Done")


if __name__ == "__main__":
    main()
