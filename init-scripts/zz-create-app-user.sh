set -eu

if [ -z "${MYSQL_APP_PASSWORD:-}" ]; then
  echo "MYSQL_APP_PASSWORD is required to create mutrapro_app"
  exit 1
fi

escaped_password="$(printf '%s' "$MYSQL_APP_PASSWORD" | sed "s/\\\\/\\\\\\\\/g; s/'/''/g")"

mysql -uroot -p"$MYSQL_ROOT_PASSWORD" <<EOSQL
CREATE USER IF NOT EXISTS 'mutrapro_app'@'%' IDENTIFIED WITH mysql_native_password BY '${escaped_password}';
ALTER USER 'mutrapro_app'@'%' IDENTIFIED WITH mysql_native_password BY '${escaped_password}';
GRANT ALL PRIVILEGES ON mutrapro_auth.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_order.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_task.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_file.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_studio.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_notification.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_analytics.* TO 'mutrapro_app'@'%';
FLUSH PRIVILEGES;
EOSQL
