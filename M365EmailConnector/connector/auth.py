"""
M365 OAuth2 authentication via MSAL (device code flow).
Tokens are cached to disk and refreshed automatically.
"""

import json
import os

import msal


GRAPH_SCOPES = [
    "Mail.Read",
    "Mail.ReadWrite",
    "Mail.Send",
    "Calendars.ReadWrite",
]

GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"


class M365Auth:
    def __init__(
        self,
        tenant_id: str,
        client_id: str,
        cache_file: str = ".token_cache.json",
    ):
        self.tenant_id = tenant_id
        self.client_id = client_id
        self.cache_file = cache_file
        self._cache = self._load_cache()
        self._app = msal.PublicClientApplication(
            client_id=client_id,
            authority=f"https://login.microsoftonline.com/{tenant_id}",
            token_cache=self._cache,
        )

    # ------------------------------------------------------------------
    # Token acquisition
    # ------------------------------------------------------------------

    def get_token(self) -> str:
        """Return a valid access token, refreshing or re-authenticating as needed."""
        token = self._acquire_silent()
        if token:
            return token

        token = self._acquire_device_code()
        self._save_cache()
        return token

    def _acquire_silent(self) -> str | None:
        accounts = self._app.get_accounts()
        if not accounts:
            return None
        result = self._app.acquire_token_silent(GRAPH_SCOPES, account=accounts[0])
        if result and "access_token" in result:
            return result["access_token"]
        return None

    def _acquire_device_code(self) -> str:
        flow = self._app.initiate_device_flow(scopes=GRAPH_SCOPES)
        if "user_code" not in flow:
            raise RuntimeError(f"Failed to create device flow: {flow.get('error_description')}")

        print("\n" + flow["message"])  # Prints the URL and user code for the user

        result = self._app.acquire_token_by_device_flow(flow)
        if "access_token" not in result:
            raise RuntimeError(
                f"Authentication failed: {result.get('error_description', result.get('error'))}"
            )
        return result["access_token"]

    # ------------------------------------------------------------------
    # Token cache persistence
    # ------------------------------------------------------------------

    def _load_cache(self) -> msal.SerializableTokenCache:
        cache = msal.SerializableTokenCache()
        if os.path.exists(self.cache_file):
            with open(self.cache_file) as f:
                cache.deserialize(f.read())
        return cache

    def _save_cache(self) -> None:
        if self._cache.has_state_changed:
            with open(self.cache_file, "w") as f:
                f.write(self._cache.serialize())
