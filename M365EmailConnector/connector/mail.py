"""
Mail operations: read, send, search messages via Microsoft Graph API.
"""

from __future__ import annotations

import base64
from typing import Any

import requests

GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"


class MailConnector:
    def __init__(self, auth):
        """
        Args:
            auth: M365Auth instance used to obtain access tokens.
        """
        self._auth = auth

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._auth.get_token()}",
            "Content-Type": "application/json",
        }

    def _get(self, path: str, params: dict | None = None) -> Any:
        resp = requests.get(f"{GRAPH_BASE_URL}{path}", headers=self._headers(), params=params)
        resp.raise_for_status()
        return resp.json()

    def _post(self, path: str, body: dict) -> Any:
        resp = requests.post(f"{GRAPH_BASE_URL}{path}", headers=self._headers(), json=body)
        resp.raise_for_status()
        return resp.json() if resp.content else None

    def _delete(self, path: str) -> None:
        resp = requests.delete(f"{GRAPH_BASE_URL}{path}", headers=self._headers())
        resp.raise_for_status()

    def _patch(self, path: str, body: dict) -> Any:
        resp = requests.patch(f"{GRAPH_BASE_URL}{path}", headers=self._headers(), json=body)
        resp.raise_for_status()
        return resp.json()

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def list_messages(
        self,
        folder: str = "inbox",
        top: int = 25,
        skip: int = 0,
        select: list[str] | None = None,
        order_by: str = "receivedDateTime desc",
    ) -> list[dict]:
        """List messages in a folder.

        Args:
            folder: Folder name or well-known folder name (inbox, sentitems, drafts, …).
            top: Number of messages to return (max 999).
            skip: Number of messages to skip (for pagination).
            select: List of fields to include (e.g. ["subject","from","receivedDateTime"]).
            order_by: OData orderBy clause.

        Returns:
            List of message dicts.
        """
        params: dict[str, Any] = {"$top": top, "$skip": skip, "$orderby": order_by}
        if select:
            params["$select"] = ",".join(select)

        data = self._get(f"/me/mailFolders/{folder}/messages", params=params)
        return data.get("value", [])

    def get_message(self, message_id: str) -> dict:
        """Fetch a single message by ID."""
        return self._get(f"/me/messages/{message_id}")

    def get_message_body(self, message_id: str) -> str:
        """Return the plain-text or HTML body of a message."""
        msg = self._get(
            f"/me/messages/{message_id}",
            params={"$select": "body"},
        )
        return msg["body"]["content"]

    def list_attachments(self, message_id: str) -> list[dict]:
        """List attachments for a message."""
        data = self._get(f"/me/messages/{message_id}/attachments")
        return data.get("value", [])

    def download_attachment(self, message_id: str, attachment_id: str) -> bytes:
        """Download an attachment and return its raw bytes."""
        att = self._get(f"/me/messages/{message_id}/attachments/{attachment_id}")
        return base64.b64decode(att["contentBytes"])

    def mark_as_read(self, message_id: str) -> dict:
        """Mark a message as read."""
        return self._patch(f"/me/messages/{message_id}", {"isRead": True})

    def delete_message(self, message_id: str) -> None:
        """Permanently delete a message."""
        self._delete(f"/me/messages/{message_id}")

    def move_message(self, message_id: str, destination_folder_id: str) -> dict:
        """Move a message to another folder."""
        return self._post(
            f"/me/messages/{message_id}/move",
            {"destinationId": destination_folder_id},
        )

    # ------------------------------------------------------------------
    # Send
    # ------------------------------------------------------------------

    def send_message(
        self,
        to: list[str],
        subject: str,
        body: str,
        body_type: str = "Text",
        cc: list[str] | None = None,
        bcc: list[str] | None = None,
        attachments: list[dict] | None = None,
        save_to_sent: bool = True,
    ) -> None:
        """Send an email immediately.

        Args:
            to: List of recipient email addresses.
            subject: Email subject.
            body: Email body content.
            body_type: "Text" or "HTML".
            cc: Optional CC addresses.
            bcc: Optional BCC addresses.
            attachments: List of attachment dicts with keys:
                         name (str), contentBytes (base64 str), contentType (str).
            save_to_sent: Whether to save to Sent Items (default True).
        """
        message: dict[str, Any] = {
            "subject": subject,
            "body": {"contentType": body_type, "content": body},
            "toRecipients": [{"emailAddress": {"address": addr}} for addr in to],
        }
        if cc:
            message["ccRecipients"] = [{"emailAddress": {"address": addr}} for addr in cc]
        if bcc:
            message["bccRecipients"] = [{"emailAddress": {"address": addr}} for addr in bcc]
        if attachments:
            message["attachments"] = [
                {
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    "name": a["name"],
                    "contentType": a.get("contentType", "application/octet-stream"),
                    "contentBytes": a["contentBytes"],
                }
                for a in attachments
            ]

        self._post("/me/sendMail", {"message": message, "saveToSentItems": save_to_sent})

    def create_draft(
        self,
        to: list[str],
        subject: str,
        body: str,
        body_type: str = "Text",
        cc: list[str] | None = None,
    ) -> dict:
        """Create a draft message (does not send).

        Returns:
            The created draft message dict including its ID.
        """
        message: dict[str, Any] = {
            "subject": subject,
            "body": {"contentType": body_type, "content": body},
            "toRecipients": [{"emailAddress": {"address": addr}} for addr in to],
        }
        if cc:
            message["ccRecipients"] = [{"emailAddress": {"address": addr}} for addr in cc]
        return self._post("/me/messages", message)

    def send_draft(self, draft_id: str) -> None:
        """Send a previously created draft."""
        resp = requests.post(
            f"{GRAPH_BASE_URL}/me/messages/{draft_id}/send",
            headers=self._headers(),
        )
        resp.raise_for_status()

    def reply_to_message(
        self,
        message_id: str,
        body: str,
        body_type: str = "Text",
    ) -> None:
        """Reply to a message."""
        self._post(
            f"/me/messages/{message_id}/reply",
            {"message": {"body": {"contentType": body_type, "content": body}}},
        )

    def forward_message(self, message_id: str, to: list[str], comment: str = "") -> None:
        """Forward a message to a list of recipients."""
        self._post(
            f"/me/messages/{message_id}/forward",
            {
                "comment": comment,
                "toRecipients": [{"emailAddress": {"address": addr}} for addr in to],
            },
        )

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    def search_messages(self, query: str, top: int = 25) -> list[dict]:
        """Search messages using a KQL query string.

        Args:
            query: KQL search string (e.g. "from:alice@example.com subject:invoice").
            top: Max results to return.

        Returns:
            List of matching message dicts.
        """
        data = self._get("/me/messages", params={"$search": f'"{query}"', "$top": top})
        return data.get("value", [])

    def filter_messages(self, filter_expr: str, top: int = 25) -> list[dict]:
        """Filter messages using an OData filter expression.

        Args:
            filter_expr: OData filter (e.g. "isRead eq false", "receivedDateTime ge 2024-01-01").
            top: Max results to return.

        Returns:
            List of matching message dicts.
        """
        data = self._get("/me/messages", params={"$filter": filter_expr, "$top": top})
        return data.get("value", [])
