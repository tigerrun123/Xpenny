# OpenClaw Google Meet Plugin Setup

Date: 2026-06-10

## Instance

- AWS Lightsail instance: `XtokenOpenClaw`
- OpenClaw version: upgraded from `2026.5.7` to `2026.6.5`
- Plugin: `@openclaw/google-meet`
- Working plugin version: upgraded from `2026.5.7` to `2026.6.5`

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

Later, OpenClaw itself was upgraded to the latest available version:

```sh
openclaw update
sudo npm i -g openclaw@latest
openclaw gateway restart
openclaw plugins install --force @openclaw/google-meet@latest
openclaw gateway restart
```

The built-in `openclaw update` command failed at first because the original install was a system-managed global npm install and needed elevated write permissions. Running the npm global upgrade with `sudo` succeeded.

Before upgrading, a config backup was created under:

```text
/home/ubuntu/.openclaw/backups/pre-upgrade-20260610-050242
```

After the upgrade:

- OpenClaw reports `2026.6.5`.
- Google Meet plugin reports `2026.6.5`.
- `openclaw plugins doctor` reports no plugin issues.
- `openclaw health` reports the Gateway event loop is ok and Telegram remains configured.

## Verified Status

- `openclaw plugins inspect google-meet` reports `Status: loaded`.
- `openclaw plugins doctor` reports no plugin issues.
- Gateway starts with `google-meet` included in the loaded plugin set.
- OpenClaw health remains clean after the plugin install.
- `openclaw googlemeet status` returns JSON with `found: true` and no active sessions.

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
   - Resolved for CLI status/setup by approving the Google Meet operator scopes on the paired local CLI device.
   - Required scopes observed on OpenClaw `2026.6.5`: `operator.admin`, `operator.approvals`, `operator.pairing`, `operator.read`, `operator.talk.secrets`, and `operator.write`.
   - The device table may still show a stale pending re-approval row, but the paired device now has matching approved scopes and `googlemeet status` runs.

2. Google OAuth
   - `googlemeet auth login` runs a PKCE OAuth flow and produces refresh-token config.
   - Do not paste or commit the resulting token JSON.

3. Audio transport on Lightsail
   - The plugin reports Chrome local audio with `blackhole-2ch` is currently macOS-only.
   - The Lightsail Ubuntu host also reported missing `sox`.
   - For a cloud-hosted voice participant, the practical path is likely Twilio transport.

## Recommended Next Path

For the AWS Lightsail setup, use Twilio transport:

1. Run Google OAuth for the Google account that will create or access the Meet.
2. Configure Twilio credentials and a dial-in flow.
3. Join a Meet with:

```sh
openclaw googlemeet join "https://meet.google.com/..." --transport twilio --message "Hi, this is the OpenClaw test agent."
```

For direct Chrome audio, run OpenClaw on a local macOS machine with the required audio device tooling instead of the Lightsail Ubuntu host.
