from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow


ROOT = Path(__file__).resolve().parents[1]
SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


def main() -> None:
    secrets = ROOT / "client_secret.json"
    token = ROOT / "youtube_token.json"
    if not secrets.exists():
        raise SystemExit(f"Missing OAuth client secret JSON: {secrets}")
    flow = InstalledAppFlow.from_client_secrets_file(str(secrets), SCOPES)
    credentials = flow.run_local_server(port=0)
    token.write_text(credentials.to_json(), encoding="utf-8")
    print(f"Wrote {token}")


if __name__ == "__main__":
    main()
