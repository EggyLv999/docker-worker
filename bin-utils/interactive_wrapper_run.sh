#!/.taskclusterutils/busybox sh
trap 'kill -TERM $PID' TERM INT
(
	exec "$@"
)
PID=$!
wait $PID
trap - TERM INT
wait $PID
EXIT_STATUS=$?
/.taskclusterutils/busybox sleep 5
/.taskclusterutils/busybox flock -x /.taskclusterinteractivesession.lock true
exit $EXIT_STATUS
