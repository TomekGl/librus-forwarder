# librus-forwarder

Simple, efficient forwarder of messages from Librus Synergia (Polish school↔parents messaging
system) to pluggable notification targets.

## How it works

The service logs into a Librus Synergia account directly (no email involved) and checks the
inbox (and, by default, the sent folder) for messages newer than the last one it has seen. It
keeps that "last seen" marker on disk (`STATE_FILE_PATH`), so each run only reports genuinely new
messages — and the very first run never floods you with history, it just sets the baseline.

New messages are forwarded to whichever notifier(s) you enable (`stdout`, `slack`) and archived as
JSON files on disk.

It does **not** poll on a timer by itself — something external has to call its HTTP endpoint to
trigger a check. See [Triggering a fetch](#triggering-a-fetch) below for the recommended
email-notification-based approach.

## Configuration

All configuration is environment variables. See [`.env.example`](.env.example) for the full,
commented list (login/password, notify targets, Slack webhook, log level, timeouts, etc.) —
that file is the source of truth, not duplicated here.

## Running locally

```bash
cp .env.example .env     # fill in LIBRUS_LOGIN/PASSWORD, FETCH_SECRET
docker compose up -d --build
curl -X POST http://localhost:8080/fetch/<FETCH_SECRET>
docker compose logs -f
```

State is kept in the `librus-forwarder-data` named Docker volume (not a host bind mount — the
container runs as a non-root user, and bind-mounted host directories come in as `root:root`,
which breaks writes).

## Deploying to Kubernetes

A Helm chart is provided in [`charts/librus-forwarder`](charts/librus-forwarder) — see its own
[README](charts/librus-forwarder/README.md) for installation instructions (required secrets, TLS
secret, Traefik CRDs). Each tagged release also publishes the chart as an OCI artifact to
`oci://ghcr.io/tomekgl/charts/librus-forwarder`.

## API

- `GET /healthz` — always `200` (a restart can't fix bad credentials or a Librus outage), with a JSON
  body reporting job health: `status` (`ok`, or `degraded` after a failed run), `running`,
  `lastSuccessAt`, `lastFailureAt`, `consecutiveFailures`. Point monitoring/alerting at `degraded`.
  Not logged (see `src/server.ts`), so Kubernetes probes don't drown out real log lines.
- `POST /fetch/<FETCH_SECRET>` — triggers a check of the Librus inbox. Responds `202` immediately
  and processes in the background; a second call while one is already running is queued, not run
  in parallel. Wrong secret → `404` (constant-time comparison, so failed attempts don't leak
  timing information about how much of the secret matched).

Each run has a hard deadline (`FETCH_DEADLINE_MS`, default 5 minutes) so a hung Librus request can
never wedge the service. If a notifier fails for a message, only that notifier is retried on the
next call (already-delivered ones are not re-sent), and a message that fails 3 times is logged as
`message_skipped` so it can't block newer ones.

```bash
curl -X POST https://your-host/fetch/<FETCH_SECRET>
```

## Triggering a fetch

Since the service only checks Librus when asked, you need something to call `POST
/fetch/<FETCH_SECRET>` for you. Polling on a timer (cron) works, but Librus also sends a plain
"you have a new message" email notification (with no message content) to the parent's regular
mailbox as soon as something arrives — so you can trigger a fetch **the moment that email shows
up**, instead of polling blindly.

If `procmail` is already your system's MDA (standard for local Unix mail delivery), add a rule
that matches mail coming from Librus and fires the `curl` call. Nothing here needs to touch your
real inbox content — the rule only looks at the `From` header.

`~/.procmailrc`:

```
:0
* ^From.*librus\.pl
| curl -fsS -m 5 -X POST https://your-host/fetch/<FETCH_SECRET> &
```

- The `From.*librus\.pl` pattern matches the notification sender's domain — adjust it if your
  school's Librus instance sends from something else.
- `-m 5` caps the curl call at 5 seconds and `&` backgrounds it, so a slow/unreachable
  librus-forwarder never blocks mail delivery.
- `-fsS`: fail silently on HTTP errors but still print them to procmail's log (`-f` + `-sS`) —
  useful for debugging without procmail choking on curl's normal progress output.

## License

MIT — see [LICENSE](LICENSE).
