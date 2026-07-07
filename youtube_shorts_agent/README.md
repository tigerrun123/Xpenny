# OpenClaw Bridge ADK Agent

This is a Google ADK agent that bridges user requests to an external OpenClaw HTTP endpoint.

The agent exposes one ADK tool, `call_openclaw`, which sends a JSON `POST` request to `OPENCLAW_URL` with:

- `message`
- `agent`, defaulting to `main`
- `source`, always `google-adk`

No secrets are hardcoded. Configure endpoint and Google Cloud settings through environment variables.

## Local Setup

```bash
cd /Users/user/Documents/New\ project/youtube_shorts_agent
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
```

Set these values in `.env`:

```env
GOOGLE_GENAI_USE_VERTEXAI=TRUE
GOOGLE_CLOUD_PROJECT=your-google-cloud-project-id
GOOGLE_CLOUD_LOCATION=us-central1
OPENCLAW_URL=https://your-openclaw-host.example.com/bridge
```

For early local testing, `OPENCLAW_URL` can be omitted. The tool will return the mock reply `OpenClaw bridge not configured yet.`

## Run Locally

Start the ADK playground:

```bash
agents-cli playground
```

Or run a smoke test from the terminal:

```bash
agents-cli run "Ask OpenClaw to summarize the current bridge status."
```

You can also use ADK directly:

```bash
adk run youtube_shorts_agent
```

Example prompt for the playground or terminal:

```text
Send this to OpenClaw: hello from Google ADK
```

Expected OpenClaw request body:

```json
{
  "message": "hello from Google ADK",
  "agent": "main",
  "source": "google-adk"
}
```

Restaurant lookup example:

```text
ask openclaw: where is The Great Wall restaurant?
```

Expected tool call:

```python
call_openclaw("where is The Great Wall restaurant?", agent="restaurant_main")
```

If OpenClaw returns `50 George St, Bathurst NSW`, the playground should show that reply to the user.

Run unit tests:

```bash
pytest
```

## Deploy To Google Agent Platform

Deploy with Agents CLI after your Google Cloud project and runtime target are configured:

```bash
agents-cli scaffold enhance --deployment-target agent_engine
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
agents-cli deploy
```

The deployed runtime must have `OPENCLAW_URL` available in its environment. If your OpenClaw endpoint requires authentication, provide credentials through your deployment platform's secret manager or environment configuration; do not commit secrets to this repository.
