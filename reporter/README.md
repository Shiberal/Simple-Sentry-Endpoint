# Resource reporter

A tiny shell script that runs inside **your monitored service's container** and pushes its CPU and RAM usage to Simple Sentry Endpoint once a minute. The numbers appear on that monitor's details (Monitors page, expand a monitor, "Resource usage") and through the MCP `monitor_resources` tool.

It reads the container's own cgroup files (v2 or v1). It does **not** need the Docker socket, extra privileges, or any published port; it only makes outbound HTTPS requests to your Simple Sentry Endpoint.

## Setup

1. Create the monitor (slug) on the Monitors page, expand it, and under **Resource usage** click **Generate token**. Copy the token; generating a new one invalidates the old one.
2. Add the script to your service's image and start it next to your app. It needs `sh` plus `curl` or `wget` (busybox `wget` on alpine is enough).

   ```dockerfile
   COPY resource-reporter.sh /usr/local/bin/resource-reporter.sh
   RUN chmod +x /usr/local/bin/resource-reporter.sh
   ```

   Start it in the background from your entrypoint before the main process:

   ```sh
   /usr/local/bin/resource-reporter.sh &
   exec node server.js
   ```

3. Set these environment variables on the service (in Coolify: the service's **Environment Variables**, then redeploy):

   | Variable | Value |
   |---|---|
   | `SENTRY_REPORT_URL` | Base URL of this app, e.g. `https://errors.example.com` |
   | `SENTRY_REPORT_TOKEN` | The token from step 1 |
   | `SENTRY_REPORT_INTERVAL` | Optional, seconds between samples (default 60, minimum 10) |

No resource limits are needed, but if you set memory or CPU limits on the container (Coolify: **Resources**), the dashboard shows usage against those limits; otherwise it shows absolute usage.

## Notes

- CPU is reported like `docker stats`: 100% is one full core, so a multi-core container can exceed 100%.
- RAM excludes reclaimable page cache, matching `docker stats`.
- Samples are kept for 7 days. The token only allows pushing samples for its one monitor.
- Seeing *other* containers from one place would need the Docker socket, which is root-equivalent on the host. This is deliberately not part of this reporter.
