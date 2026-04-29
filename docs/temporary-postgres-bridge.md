# Temporary Postgres Bridge

Use this when Postgres is inside the Docker/Portainer stack network and you need short-lived local access without changing `docker-compose.portainer.yml`.

This method starts a temporary `alpine/socat` container in the same Docker network as the stack and binds Postgres to `127.0.0.1` on the server only.

## 1. Find the Stack Network

```bash
docker network ls
```

Look for the Portainer stack network, usually:

```text
<stack-name>_default
```

Example:

```text
ovdp_default
```

## 2. Start the Bridge

Replace `ovdp_default` with the actual Docker network name.

```bash
docker run --rm -d \
  --name pg-temp-bridge \
  --network ovdp_default \
  -p 127.0.0.1:5432:5432 \
  alpine/socat \
  tcp-listen:5432,fork,reuseaddr tcp-connect:postgres:5432
```

Postgres is now reachable on the server at:

```text
127.0.0.1:5432
```

The port is not exposed publicly because it is bound to server localhost only.

## 3. Connect from Your Laptop

Create an SSH tunnel:

```bash
ssh -L 5433:127.0.0.1:5432 user@server
```

Then connect locally:

```bash
psql "postgresql://postgres:PASSWORD@127.0.0.1:5433/ovdp_bot"
```

Or use the same host/port in a GUI client:

```text
host: 127.0.0.1
port: 5433
database: ovdp_bot
user: postgres
password: PASSWORD
```

## 4. Stop the Bridge

```bash
docker stop pg-temp-bridge
```

Because the container runs with `--rm`, it is removed automatically after stopping.

## Notes

- Do not bind this bridge to `0.0.0.0`.
- Do not use `-p 5432:5432` unless the server firewall explicitly blocks external access.
- This is for temporary debugging/admin access only.
- If Portainer uses a different Postgres service name, replace `postgres` in `tcp-connect:postgres:5432`.
