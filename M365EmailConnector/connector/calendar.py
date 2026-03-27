"""
Calendar management via Microsoft Graph API.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

import requests

GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"


class CalendarConnector:
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
    # Calendars
    # ------------------------------------------------------------------

    def list_calendars(self) -> list[dict]:
        """List all calendars for the signed-in user."""
        data = self._get("/me/calendars")
        return data.get("value", [])

    def get_calendar(self, calendar_id: str = "primary") -> dict:
        """Get a calendar by ID. Use 'primary' for the default calendar."""
        if calendar_id == "primary":
            return self._get("/me/calendar")
        return self._get(f"/me/calendars/{calendar_id}")

    def create_calendar(self, name: str) -> dict:
        """Create a new calendar."""
        return self._post("/me/calendars", {"name": name})

    def delete_calendar(self, calendar_id: str) -> None:
        """Delete a calendar."""
        self._delete(f"/me/calendars/{calendar_id}")

    # ------------------------------------------------------------------
    # Events
    # ------------------------------------------------------------------

    def list_events(
        self,
        calendar_id: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
        top: int = 25,
    ) -> list[dict]:
        """List events, optionally filtered by date range.

        Args:
            calendar_id: Calendar ID. If None, uses the default calendar.
            start: Start of date range filter (UTC).
            end: End of date range filter (UTC).
            top: Max number of events to return.

        Returns:
            List of event dicts.
        """
        path = f"/me/calendars/{calendar_id}/events" if calendar_id else "/me/events"
        params: dict[str, Any] = {
            "$top": top,
            "$orderby": "start/dateTime",
        }
        if start and end:
            params["$filter"] = (
                f"start/dateTime ge '{start.isoformat()}' "
                f"and end/dateTime le '{end.isoformat()}'"
            )
        data = self._get(path, params=params)
        return data.get("value", [])

    def get_event(self, event_id: str) -> dict:
        """Get a single event by ID."""
        return self._get(f"/me/events/{event_id}")

    def create_event(
        self,
        subject: str,
        start: datetime,
        end: datetime,
        timezone: str = "UTC",
        body: str = "",
        body_type: str = "Text",
        attendees: list[str] | None = None,
        location: str | None = None,
        is_online_meeting: bool = False,
        calendar_id: str | None = None,
    ) -> dict:
        """Create a calendar event.

        Args:
            subject: Event title.
            start: Start datetime (UTC unless timezone specified).
            end: End datetime.
            timezone: IANA timezone name (e.g. "America/New_York").
            body: Event description.
            body_type: "Text" or "HTML".
            attendees: List of attendee email addresses.
            location: Physical or virtual location string.
            is_online_meeting: Create a Teams meeting link.
            calendar_id: Target calendar ID. Defaults to the primary calendar.

        Returns:
            The created event dict.
        """
        payload: dict[str, Any] = {
            "subject": subject,
            "body": {"contentType": body_type, "content": body},
            "start": {"dateTime": start.isoformat(), "timeZone": timezone},
            "end": {"dateTime": end.isoformat(), "timeZone": timezone},
            "isOnlineMeeting": is_online_meeting,
        }
        if attendees:
            payload["attendees"] = [
                {"emailAddress": {"address": addr}, "type": "required"}
                for addr in attendees
            ]
        if location:
            payload["location"] = {"displayName": location}

        path = f"/me/calendars/{calendar_id}/events" if calendar_id else "/me/events"
        return self._post(path, payload)

    def update_event(self, event_id: str, updates: dict) -> dict:
        """Partially update an event.

        Args:
            event_id: ID of the event to update.
            updates: Dict of fields to update (same schema as create_event body).

        Returns:
            Updated event dict.
        """
        return self._patch(f"/me/events/{event_id}", updates)

    def delete_event(self, event_id: str) -> None:
        """Cancel and delete an event."""
        self._delete(f"/me/events/{event_id}")

    def accept_event(self, event_id: str, comment: str = "") -> None:
        """Accept a meeting invitation."""
        self._post(f"/me/events/{event_id}/accept", {"comment": comment, "sendResponse": True})

    def decline_event(self, event_id: str, comment: str = "") -> None:
        """Decline a meeting invitation."""
        self._post(f"/me/events/{event_id}/decline", {"comment": comment, "sendResponse": True})

    def tentatively_accept_event(self, event_id: str, comment: str = "") -> None:
        """Tentatively accept a meeting invitation."""
        self._post(
            f"/me/events/{event_id}/tentativelyAccept",
            {"comment": comment, "sendResponse": True},
        )

    def get_schedule_view(
        self,
        start: datetime,
        end: datetime,
        timezone: str = "UTC",
    ) -> list[dict]:
        """Get calendar view (all events in a time window) from the primary calendar."""
        params = {
            "startDateTime": start.isoformat(),
            "endDateTime": end.isoformat(),
            "$top": 100,
        }
        headers = {**self._headers(), "Prefer": f'outlook.timezone="{timezone}"'}
        resp = requests.get(
            f"{GRAPH_BASE_URL}/me/calendarView",
            headers=headers,
            params=params,
        )
        resp.raise_for_status()
        return resp.json().get("value", [])
