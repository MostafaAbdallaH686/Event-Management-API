#!/bin/sh
set -e

until mysql -h"$1" -u"$2" -p"$3" -e "SELECT 1" > /dev/null 2>&1; do
  >&2 echo "MySQL is unavailable - sleeping"
  sleep 5
done

>&2 echo "MySQL is up - executing command"
exec "${@:4}"