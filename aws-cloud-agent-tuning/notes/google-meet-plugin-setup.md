# OpenClaw Google Meet Plugin Setup

Date: 2026-06-10

## Instance

- AWS Lightsail instance: `XtokenOpenClaw`
- OpenClaw version: `2026.5.7`
- Plugin: `@openclaw/google-meet`
- Working plugin version: `2026.5.7`

## What Was Done

Installed the official Google Meet participant plugin and pinned it to the host-compatible version:

```sh
openclaw plugins install --force @openclaw/google-meet@2026.5.7
openclaw gateway restart
openclaw plugins doctor
openclaw health
```

The latest plugin version available during setup was `2026.6.5`, but it failed to load on OpenClaw `2026.5.7` with:

```text
optionalPositiveIntegerSchema is not a function
```

Pinning the plugin to `2026.5.7` fixed the plugin API mismatch.

## Verified Status

- `openclaw plugins inspect google-meet` reports `Status: loaded`.
- `openclaw plugins doctor` reports no plugin issues.
- Gateway starts with `google-meet` included in the loaded plugin set.
- OpenClaw health remains clean after the plugin install.

## Available CLI Surface

The plugin registers:

```sh
openclaw googlemeet
```

Important subcommands observed:

- `auth`: Google Meet OAuth helpers
- `create`: create a new Google Meet space and print its meeting URL
- `join`: join a Google Meet URL
- `leave`: leave a meeting
- `speak`: send realtime speech into a meeting
- `attendance`: list Meet participants and sessions
- `artifacts`: list conference records and metadata
- `latest`: find the latest conference record
- `preflight`: validate OAuth and meeting prerequisites
- `doctor`: show Meet/browser/realtime health
- `setup`: show transport setup status

`join` supports transports:

```text
chrome, chrome-node, twilio
```

## Current Blockers For Real Meeting Test

The plugin is installed and loaded, but a full Google Meet voice test needs extra setup:

1. OpenClaw Gateway scope approval
   - Some `googlemeet` commands requested broader Gateway scopes.
   - OpenClaw returned `scope upgrade pending approval`.
   - This must be approved in the OpenClaw pairing/authorization flow before those CLI commands can run fully.

2. Google OAuth
   - `googlemeet auth login` runs a PKCE OAuth flow and produces refresh-token config.
   - Do not paste or commit the resulting token JSON.

3. Audio transport on Lightsail
   - The plugin reports Chrome local audio with `blackhole-2ch` is currently macOS-only.
   - The Lightsail Ubuntu host also reported missing `sox`.
   - For a cloud-hosted voice participant, the practical path is likely Twilio transport.

## Recommended Next Path

For the AWS Lightsail setup, use Twilio transport:

1. Approve the OpenClaw Gateway scope upgrade.
2. Run Google OAuth for the Google account that will create or access the Meet.
3. Configure Twilio credentials and a dial-in flow.
4. Join a Meet with:

```sh
openclaw googlemeet join "https://meet.google.com/..." --transport twilio --message "Hi, this is the OpenClaw test agent."
```

For direct Chrome audio, run OpenClaw on a local macOS machine with the required audio device tooling instead of the Lightsail Ubuntu host.
