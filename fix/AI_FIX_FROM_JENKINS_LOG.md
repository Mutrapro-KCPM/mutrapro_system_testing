# AI Fix Brief: Jenkins deploy still fails because `auth-service` cannot connect to MySQL

## Summary

Jenkins pipeline still fails during the `Deploy` stage after `docker compose up -d`.

The immediate failing dependency is:

```text
dependency failed to start: container mutrapro_system_testing-auth-service-1 is unhealthy
```

The key service log is:

```text
auth-service-1 | error: [DB] Connection attempt 1/10 failed: Access denied for user 'mutrapro_app'@'172.18.0.10' (using password: YES)
...
auth-service-1 | error: [DB] Connection attempt 10/10 failed: Access denied for user 'mutrapro_app'@'172.18.0.10' (using password: YES)
```

So this is not primarily a Docker build failure. The build succeeds. The deploy fails because `auth-service` cannot authenticate to MySQL.

Previous run failed with `root`. The latest run has moved to `mutrapro_app`, so the previous fix was partly applied, but the app user still is not usable by `auth-service`.

## Pipeline Context

- Jenkins workspace: `/var/jenkins_home/workspace/mutrapro_system`
- Git repo: `https://github.com/Mutrapro-KCPM/mutrapro_system_testing.git`
- Branch checked out: `origin/dev`
- Latest failing commit checked out: `7bd9dd6432a878447fd8dad8f77ef1abf3372669`
- Latest commit message shown by Jenkins: `fix: reset jenkins mysql volume and switch to app user`
- Latest failure time in container logs: `2026-05-31 14:15:57` to `2026-05-31 14:17:25` UTC

The latest Jenkins run does remove the old volume:

```text
+ docker volume rm mutrapro_system_testing_mysql_data
mutrapro_system_testing_mysql_data
```

So the original stale-volume theory is no longer the primary blocker for this run.

## What succeeded

The pipeline successfully completed:

1. Checkout
2. `docker compose config`
3. `docker compose down --remove-orphans`
4. `docker compose build --no-cache`
5. `docker volume rm mutrapro_system_testing_mysql_data`
6. Container creation/startup up to MySQL and several services

The web app also built successfully, only with warnings.

## What failed

The deploy step failed here:

```text
Container mutrapro_system_testing-auth-service-1 Waiting
Container mutrapro_system_testing-auth-service-1 Error dependency auth-service failed to start
dependency failed to start: container mutrapro_system_testing-auth-service-1 is unhealthy
```

Because `api-gateway` depends on `auth-service` with:

```yaml
auth-service:
  condition: service_healthy
```

`api-gateway` never starts successfully once `auth-service` is unhealthy.

## Relevant files

- `docker-compose.yml`
- `Jenkinsfile`
- `services/auth-service/index.js`
- `init-scripts/init.sql`
- Jenkins log attachment: `C:\Users\LENOVO\.codex\attachments\056fa1c1-64a0-4012-a9ba-00ac6f3d812e\pasted-text.txt`

## Current MySQL/Auth configuration

From `docker-compose.yml`:

```yaml
mysql_db:
  image: mysql:8.0
  environment:
    MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
  volumes:
    - ./init-scripts:/docker-entrypoint-initdb.d
    - mysql_data:/var/lib/mysql

auth-service:
  environment:
    - DB_HOST=mysql_db
    - DB_USER=mutrapro_app
    - DB_PASSWORD=${DB_PASSWORD}
    - DB_AUTH_NAME=mutrapro_auth
  depends_on:
    mysql_db:
      condition: service_healthy
```

From `Jenkinsfile`:

```groovy
DB_PASSWORD = '123456'
```

From `services/auth-service/index.js`:

```js
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_AUTH_NAME,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);
```

The service calls `ensureSoftDeleteColumn()` before `app.listen()`. If the DB login fails, the service exits and never becomes healthy.

From `init-scripts/init.sql`, the app user is intended to be created:

```sql
CREATE USER IF NOT EXISTS 'mutrapro_app'@'%' IDENTIFIED WITH mysql_native_password BY '123456';
GRANT ALL PRIVILEGES ON mutrapro_auth.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_order.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_task.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_file.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_studio.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_notification.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_analytics.* TO 'mutrapro_app'@'%';
FLUSH PRIVILEGES;
```

## Current most likely root cause

The latest failure means one of these is true:

1. `init-scripts/init.sql` on the Jenkins workspace does not contain the `CREATE USER` / `GRANT` block that exists locally.
2. The `/docker-entrypoint-initdb.d/init.sql` bind mount exists but is not being executed during MySQL initialization.
3. The user is created with different authentication data than the app expects.
4. The user exists, but not for the host pattern used by Docker networking.

The MySQL log from the latest run shows database initialization:

```text
mysql_db-1 | [Entrypoint]: Initializing database files
mysql_db-1 | [Entrypoint]: Database files initialized
mysql_db-1 | [Entrypoint]: MySQL init process done. Ready for start up.
```

But the captured log does not show an entrypoint line like:

```text
running /docker-entrypoint-initdb.d/init.sql
```

That absence is suspicious. First verify whether the init script is really present inside the running MySQL container and whether `mutrapro_app` exists.

## Immediate verification commands for Jenkins host

Run these after the failed pipeline, while containers are still present:

```sh
docker compose exec mysql_db ls -l /docker-entrypoint-initdb.d
docker compose exec mysql_db sed -n '200,240p' /docker-entrypoint-initdb.d/init.sql
docker compose exec mysql_db mysql -uroot -p123456 -e "SELECT user, host, plugin FROM mysql.user;"
docker compose exec mysql_db mysql -uroot -p123456 -e "SHOW GRANTS FOR 'mutrapro_app'@'%';"
docker compose exec mysql_db mysql -umutrapro_app -p123456 -h127.0.0.1 mutrapro_auth -e "SELECT 1;"
```

Expected:

```text
mutrapro_app | % | mysql_native_password
```

and the direct login as `mutrapro_app` should return `1`.

If `mutrapro_app` is missing, the init script did not run or did not include the user block on Jenkins.

If `mutrapro_app` exists but login fails, recreate the user explicitly:

```sh
docker compose exec mysql_db mysql -uroot -p123456
```

Then run:

```sql
DROP USER IF EXISTS 'mutrapro_app'@'%';
CREATE USER 'mutrapro_app'@'%' IDENTIFIED WITH mysql_native_password BY '123456';
GRANT ALL PRIVILEGES ON mutrapro_auth.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_order.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_task.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_file.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_studio.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_notification.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_analytics.* TO 'mutrapro_app'@'%';
FLUSH PRIVILEGES;
```

Then:

```sh
docker compose restart auth-service
docker compose logs --tail=100 auth-service
```

## Recommended code fix

Make the app user creation impossible to miss and easier to diagnose.

### Fix 1: Add an explicit Jenkins verification stage after deploy starts MySQL

Before starting all services, or immediately after MySQL becomes healthy, run:

```sh
docker compose up -d mysql_db
docker compose exec -T mysql_db mysql -uroot -p123456 -e "SELECT user, host, plugin FROM mysql.user WHERE user='mutrapro_app';"
docker compose exec -T mysql_db mysql -umutrapro_app -p123456 mutrapro_auth -e "SELECT 1;"
```

If this fails, fail the pipeline before building/running the rest of the stack.

### Fix 2: Split app user creation into a dedicated init file

Create a separate file:

```text
init-scripts/99-create-app-user.sql
```

with:

```sql
CREATE USER IF NOT EXISTS 'mutrapro_app'@'%' IDENTIFIED WITH mysql_native_password BY '123456';
GRANT ALL PRIVILEGES ON mutrapro_auth.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_order.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_task.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_file.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_studio.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_notification.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_analytics.* TO 'mutrapro_app'@'%';
FLUSH PRIVILEGES;
```

This makes it easier to see from logs whether the user creation file was picked up.

### Fix 3: Add a root-only app-user bootstrap fallback for CI

If this is a CI/demo environment and volume reset is acceptable, Jenkins can run a deterministic bootstrap after MySQL starts:

```sh
docker compose up -d mysql_db
docker compose exec -T mysql_db mysql -uroot -p123456 < init-scripts/99-create-app-user.sql
docker compose up -d
```

Do this only if shell input redirection is supported in the Jenkins environment. Otherwise use:

```sh
docker compose exec -T mysql_db mysql -uroot -p123456 -e "CREATE USER IF NOT EXISTS 'mutrapro_app'@'%' IDENTIFIED WITH mysql_native_password BY '123456'; GRANT ALL PRIVILEGES ON mutrapro_auth.* TO 'mutrapro_app'@'%'; FLUSH PRIVILEGES;"
```

## Previous root cause, now partly addressed

The Jenkins server has an existing Docker named volume:

```text
mutrapro_system_testing_mysql_data
```

The pipeline runs:

```sh
docker compose down --remove-orphans
```

This does not remove named volumes.

For the official MySQL Docker image, `MYSQL_ROOT_PASSWORD` is only used when `/var/lib/mysql` is initialized for the first time. If the existing `mysql_data` volume was initialized with another root password, changing `DB_PASSWORD` to `123456` in Jenkins or `.env` will not update the existing MySQL root password.

That matched the previous log:

```text
Access denied for user 'root'@'172.18.0.14' (using password: YES)
```

The latest run removes this volume, so stale `root` password is probably fixed. The new blocker is specifically `mutrapro_app` authentication.

Also note: the MySQL healthcheck may still appear healthy because `mysqladmin ping` mainly confirms that the server is alive. It can be misleading when the application user is wrong.

## Secondary issues seen in the log

These are not the deploy-stopping failure:

1. Docker Compose warning:

```text
Docker Compose requires buildx plugin to be installed
```

Build still completed successfully.

2. Web app ESLint warnings:

```text
React Hook useEffect has a missing dependency
React Hook useCallback has a missing dependency
Unexpected whitespace before property
```

The React build still completed successfully.

3. Browser data warnings:

```text
Browserslist: browsers data (caniuse-lite) is 7 months old
baseline-browser-mapping data is over two months old
```

These are maintenance warnings, not the current deploy blocker.

## Historical fix options from previous run

These were useful for the earlier `root` authentication failure. In the latest run, Jenkins already removed `mutrapro_system_testing_mysql_data`, so do not start here unless the verification commands above prove the volume was not actually reset.

### Option A: Reset the Jenkins MySQL volume

Use this only if losing Jenkins database state is acceptable.

On the Jenkins host/workspace:

```sh
docker compose down --remove-orphans -v
docker compose up -d --build
```

Or remove only the project MySQL volume:

```sh
docker volume rm mutrapro_system_testing_mysql_data
docker compose up -d
```

This forces MySQL to reinitialize using:

```text
MYSQL_ROOT_PASSWORD=123456
```

and reruns `init-scripts/init.sql`.

### Option B: Keep the volume and fix the MySQL password/user

Use this if preserving data is required.

Log into MySQL with the actual existing root password, then align the password:

```sql
ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY '123456';
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456';
FLUSH PRIVILEGES;
```

Then redeploy:

```sh
docker compose restart mysql_db auth-service
docker compose up -d
```

If root remote access is not available, create a dedicated application user instead.

### Option C: Create a dedicated app DB user

This is the better long-term fix.

Add to `init-scripts/init.sql`:

```sql
CREATE USER IF NOT EXISTS 'mutrapro_app'@'%' IDENTIFIED WITH mysql_native_password BY '123456';
GRANT ALL PRIVILEGES ON mutrapro_auth.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_order.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_task.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_file.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_studio.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_notification.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_analytics.* TO 'mutrapro_app'@'%';
FLUSH PRIVILEGES;
```

Then change service env in `docker-compose.yml`:

```yaml
- DB_USER=mutrapro_app
- DB_PASSWORD=${DB_PASSWORD}
```

Important: if the MySQL volume already exists, adding this to `init.sql` alone will not run automatically. Apply it manually to the existing DB, or recreate the volume.

## Verification commands

Run these on the Jenkins host after applying a fix:

```sh
docker compose ps
docker compose logs --tail=100 mysql_db
docker compose logs --tail=100 auth-service
docker compose exec mysql_db mysql -uroot -p123456 -e "SELECT 1;"
docker compose exec mysql_db mysql -uroot -p123456 -e "SHOW DATABASES;"
docker compose exec auth-service wget -qO- http://localhost:3001/health
```

Expected result:

```text
auth-service: Up ... (healthy)
api-gateway: Up ... (healthy)
```

And `auth-service` should log something like:

```text
[DB] Auth service connected to database successfully
[AUTH] Auth Service is running on port 3001
```

## Suggested Jenkinsfile improvement

Before deploy, print the current project volumes to make stale volume issues visible:

```sh
docker volume ls | grep mutrapro_system_testing || true
```

For clean CI environments where data preservation is not required, consider using:

```sh
docker compose down --remove-orphans -v
```

For persistent demo/staging environments, do not delete volumes automatically. Instead add a documented migration/user-password step.

## Do not fix by only changing healthcheck timing

Increasing `start_period`, `interval`, or `retries` will not solve this failure. The service is not slow; it is being rejected by MySQL authentication.

Fix the MySQL credentials, the persisted volume state, or the application DB user.
