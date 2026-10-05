#!/bin/sh
# Pushes this container's CPU and RAM usage to Simple Sentry Endpoint, once a minute.
# Reads the container's own cgroup files (v2 or v1); needs no Docker socket and no extra privileges.
#
#   SENTRY_REPORT_URL    base URL of your Simple Sentry Endpoint, e.g. https://errors.example.com
#   SENTRY_REPORT_TOKEN  per-monitor token (Monitors page > monitor details > Resource usage)
#   SENTRY_REPORT_INTERVAL  seconds between samples (default 60, minimum 10)
#
# Requires: sh, and either curl or wget (busybox wget works). Works on alpine, debian, ubuntu.

URL="${SENTRY_REPORT_URL%/}/api/monitor-resources"
INTERVAL="${SENTRY_REPORT_INTERVAL:-60}"
[ "$INTERVAL" -lt 10 ] 2>/dev/null && INTERVAL=10

if [ -z "$SENTRY_REPORT_URL" ] || [ -z "$SENTRY_REPORT_TOKEN" ]; then
  echo "[resource-reporter] SENTRY_REPORT_URL and SENTRY_REPORT_TOKEN are required" >&2
  exit 1
fi

CG=/sys/fs/cgroup

# Prints "cpu_usec mem_used_bytes mem_limit_bytes cpu_limit_cores"; empty fields become "null".
read_cgroup() {
  if [ -r "$CG/cgroup.controllers" ] && [ -r "$CG/memory.current" ]; then
    cpu=$(awk '$1=="usage_usec"{print $2}' "$CG/cpu.stat" 2>/dev/null)
    cur=$(cat "$CG/memory.current")
    inactive=$(awk '$1=="inactive_file"{print $2}' "$CG/memory.stat" 2>/dev/null)
    mem=$((cur - ${inactive:-0}))
    max=$(cat "$CG/memory.max" 2>/dev/null)
    [ "$max" = "max" ] && max=null
    cores=$(awk '$1!="max"{printf "%.3f", $1/$2}' "$CG/cpu.max" 2>/dev/null)
  elif [ -r "$CG/memory/memory.usage_in_bytes" ]; then
    d="$CG/cpu,cpuacct"; [ -r "$d/cpuacct.usage" ] || d="$CG/cpuacct"; [ -r "$d/cpuacct.usage" ] || d="$CG/cpu"
    ns=$(cat "$d/cpuacct.usage" 2>/dev/null)
    [ -r "$d/cpu.cfs_quota_us" ] || d_cfs="$CG/cpu"; d_cfs="${d_cfs:-$d}"
    cpu=$([ -n "$ns" ] && echo $((ns / 1000)))
    cur=$(cat "$CG/memory/memory.usage_in_bytes")
    inactive=$(awk '$1=="total_inactive_file"{print $2}' "$CG/memory/memory.stat" 2>/dev/null)
    mem=$((cur - ${inactive:-0}))
    max=$(cat "$CG/memory/memory.limit_in_bytes" 2>/dev/null)
    # v1 reports a huge number when there is no limit
    [ "${#max}" -gt 15 ] && max=null
    q=$(cat "$d_cfs/cpu.cfs_quota_us" 2>/dev/null); p=$(cat "$d_cfs/cpu.cfs_period_us" 2>/dev/null)
    cores=$([ "${q:-0}" -gt 0 ] 2>/dev/null && [ -n "$p" ] && awk -v q="$q" -v p="$p" 'BEGIN{printf "%.3f", q/p}')
  else
    echo "[resource-reporter] no cgroup files found; is this running inside a container?" >&2
    return 1
  fi
  echo "${cpu:-null} ${mem:-null} ${max:-null} ${cores:-null}"
}

post() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS -m 10 -X POST "$URL" -H "Authorization: Bearer $SENTRY_REPORT_TOKEN" \
      -H "Content-Type: application/json" -d "$1" >/dev/null
  else
    wget -q -T 10 -O /dev/null --header "Authorization: Bearer $SENTRY_REPORT_TOKEN" \
      --header "Content-Type: application/json" --post-data "$1" "$URL"
  fi
}

prev=$(read_cgroup) || exit 1
prev_t=$(date +%s)

while true; do
  sleep "$INTERVAL"
  cur=$(read_cgroup) || continue
  t=$(date +%s)
  set -- $prev; p_cpu=$1
  set -- $cur; c_cpu=$1; mem=$2; max=$3; cores=$4
  cpu_pct=null
  if [ "$p_cpu" != null ] && [ "$c_cpu" != null ] && [ "$t" -gt "$prev_t" ]; then
    # 100 = one full core, like `docker stats`
    cpu_pct=$(awk -v a="$p_cpu" -v b="$c_cpu" -v s=$((t - prev_t)) 'BEGIN{v=(b-a)/1000000/s*100; if(v<0)v=0; printf "%.2f", v}')
  fi
  prev=$cur; prev_t=$t
  post "{\"cpuPercent\":$cpu_pct,\"memUsedBytes\":$mem,\"memLimitBytes\":$max,\"cpuLimitCores\":$cores}" \
    || echo "[resource-reporter] push failed, will retry next interval" >&2
done
