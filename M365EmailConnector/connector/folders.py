"""
Mail folder management via Microsoft Graph API.
"""

from __future__ import annotations

from typing import Any

import requests

GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"


class FolderConnector:
    def __init__(self, auth):
        self._auth = auth

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
        return resp.json()

    def _patch(self, path: str, body: dict) -> Any:
        resp = requests.patch(f"{GRAPH_BASE_URL}{path}", headers=self._headers(), json=body)
        resp.raise_for_status()
        return resp.json()

    def _delete(self, path: str) -> None:
        resp = requests.delete(f"{GRAPH_BASE_URL}{path}", headers=self._headers())
        resp.raise_for_status()

    # ------------------------------------------------------------------
    # Folder operations
    # ------------------------------------------------------------------

    def list_folders(self, include_hidden: bool = False) -> list[dict]:
        """List top-level mail folders.

        Args:
            include_hidden: Whether to include hidden folders.

        Returns:
            List of folder dicts (id, displayName, totalItemCount, unreadItemCount).
        """
        params: dict[str, Any] = {"$top": 100}
        if include_hidden:
            params["includeHiddenFolders"] = "true"
        data = self._get("/me/mailFolders", params=params)
        return data.get("value", [])

    def list_child_folders(self, folder_id: str) -> list[dict]:
        """List child folders of a given folder."""
        data = self._get(f"/me/mailFolders/{folder_id}/childFolders", params={"$top": 100})
        return data.get("value", [])

    def get_folder(self, folder_id: str) -> dict:
        """Get a folder by its ID or well-known name (inbox, drafts, sentitems, …)."""
        return self._get(f"/me/mailFolders/{folder_id}")

    def create_folder(self, display_name: str, parent_folder_id: str | None = None) -> dict:
        """Create a new mail folder.

        Args:
            display_name: Name for the new folder.
            parent_folder_id: Parent folder ID or well-known name. If None, creates at root.

        Returns:
            The created folder dict.
        """
        if parent_folder_id:
            path = f"/me/mailFolders/{parent_folder_id}/childFolders"
        else:
            path = "/me/mailFolders"
        return self._post(path, {"displayName": display_name})

    def rename_folder(self, folder_id: str, new_name: str) -> dict:
        """Rename an existing folder."""
        return self._patch(f"/me/mailFolders/{folder_id}", {"displayName": new_name})

    def delete_folder(self, folder_id: str) -> None:
        """Delete a folder and all its contents."""
        self._delete(f"/me/mailFolders/{folder_id}")

    def move_folder(self, folder_id: str, destination_folder_id: str) -> dict:
        """Move a folder inside another folder."""
        return self._post(
            f"/me/mailFolders/{folder_id}/move",
            {"destinationId": destination_folder_id},
        )

    def copy_folder(self, folder_id: str, destination_folder_id: str) -> dict:
        """Copy a folder into another folder."""
        return self._post(
            f"/me/mailFolders/{folder_id}/copy",
            {"destinationId": destination_folder_id},
        )

    def get_folder_message_count(self, folder_id: str) -> dict[str, int]:
        """Return total and unread message counts for a folder."""
        folder = self._get(
            f"/me/mailFolders/{folder_id}",
            params={"$select": "displayName,totalItemCount,unreadItemCount"},
        )
        return {
            "displayName": folder["displayName"],
            "total": folder["totalItemCount"],
            "unread": folder["unreadItemCount"],
        }
