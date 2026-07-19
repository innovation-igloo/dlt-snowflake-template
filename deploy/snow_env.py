"""Bridge a Snowflake CLI named connection into dlt / connector env vars.

Reads ~/.snowflake/connections.toml (honoring $SNOWFLAKE_HOME) and prints shell
`export` lines so a laptop can authenticate the Snowflake destination from the
same connection the `snow` CLI uses -- no `.dlt/secrets.toml` and no second copy
of the credential on disk.

Usage (see the Makefile `snow-env` / `run-sf` targets):

    eval "$(uv run python -m deploy.snow_env innovation-igloo)"
    DLT_DESTINATION=snowflake python -m pipelines.run pg_public

Emits, for whatever keys the connection defines:
  * dlt destination : DESTINATION__SNOWFLAKE__CREDENTIALS__{HOST,USERNAME,ROLE,
                      WAREHOUSE,PASSWORD,AUTHENTICATOR,PRIVATE_KEY_PATH,
                      PRIVATE_KEY_PASSPHRASE}
  * connector       : SNOWFLAKE_{ACCOUNT,USER,ROLE,WAREHOUSE,PASSWORD,
                      AUTHENTICATOR,PRIVATE_KEY_PATH}  (used by registry_store)

Auth secret precedence per connection: password, else private key path, else
authenticator (e.g. externalbrowser). Non-secret fields are always emitted.
Secrets are printed to stdout only for `eval`; warnings go to stderr.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import tomllib
from pathlib import Path


def _connections_path() -> Path:
    home = os.environ.get("SNOWFLAKE_HOME")
    base = Path(home) if home else Path.home() / ".snowflake"
    return base / "connections.toml"


def _shell_quote(value: str) -> str:
    """Single-quote a value for safe shell `eval`."""
    return "'" + str(value).replace("'", "'\\''") + "'"


def _emit(pairs: list[tuple[str, str]]) -> str:
    return "\n".join(f"export {k}={_shell_quote(v)}" for k, v in pairs)


def build_exports(conn: dict[str, object]) -> tuple[list[tuple[str, str]], list[str]]:
    """Map a connection dict to (export pairs, warnings)."""
    pairs: list[tuple[str, str]] = []
    warnings: list[str] = []

    def put(dlt_key: str | None, sf_key: str | None, value: object) -> None:
        if value is None:
            return
        v = str(value)
        if dlt_key:
            pairs.append((f"DESTINATION__SNOWFLAKE__CREDENTIALS__{dlt_key}", v))
        if sf_key:
            pairs.append((sf_key, v))

    # dlt's snowflake "host" is the account identifier (see .dlt/secrets.toml.example).
    put("HOST", "SNOWFLAKE_ACCOUNT", conn.get("account"))
    put("USERNAME", "SNOWFLAKE_USER", conn.get("user"))
    put("ROLE", "SNOWFLAKE_ROLE", conn.get("role"))
    put("WAREHOUSE", "SNOWFLAKE_WAREHOUSE", conn.get("warehouse"))

    # The authenticator (if any) is the mode — always pass it through.
    authenticator = conn.get("authenticator")
    if authenticator is not None:
        put("AUTHENTICATOR", "SNOWFLAKE_AUTHENTICATOR", authenticator)

    # Secret: password > PAT token > private key. externalbrowser/SSO carries no
    # inline secret and authenticates interactively, which is fine.
    password = conn.get("password")
    token = conn.get("token")
    key_path = conn.get("private_key_file") or conn.get("private_key_path")

    if password is not None:
        put("PASSWORD", "SNOWFLAKE_PASSWORD", password)
    elif token is not None:
        # PAT / OAuth token (authenticator is typically programmatic_access_token or oauth).
        put("TOKEN", "SNOWFLAKE_TOKEN", token)
    elif key_path is not None:
        put("PRIVATE_KEY_PATH", "SNOWFLAKE_PRIVATE_KEY_PATH", key_path)
        passphrase = conn.get("private_key_file_pwd") or conn.get("private_key_passphrase")
        put("PRIVATE_KEY_PASSPHRASE", None, passphrase)
    elif authenticator is None:
        warnings.append(
            "connection has no password / token / private_key / authenticator. "
            "The secret is likely in your OS keyring. Add `authenticator = "
            "\"externalbrowser\"` to the connection, or a private_key_file, so the "
            "destination can authenticate."
        )

    return pairs, warnings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="deploy.snow_env",
        description="Emit shell export lines for a snow CLI connection (eval them).",
    )
    parser.add_argument(
        "connection",
        nargs="?",
        help="connection name; defaults to default_connection_name in connections.toml",
    )
    args = parser.parse_args(sys.argv[1:] if argv is None else argv)

    path = _connections_path()
    if not path.exists():
        print(f"# snow_env: {path} not found", file=sys.stderr)
        return 1

    data = tomllib.loads(path.read_text())

    # connections.toml is either flat ({name: {...}}) with a default_connection_name,
    # or nested under [connections]. Support both.
    default_name = data.get("default_connection_name")
    conns = data.get("connections") if isinstance(data.get("connections"), dict) else data

    name = args.connection or default_name or os.environ.get("SNOWFLAKE_DEFAULT_CONNECTION_NAME")
    if not name:
        print("# snow_env: no connection name given and no default_connection_name", file=sys.stderr)
        return 2

    conn = conns.get(name)
    if not isinstance(conn, dict):
        available = ", ".join(k for k, v in conns.items() if isinstance(v, dict))
        print(f"# snow_env: connection '{name}' not found. Available: {available}", file=sys.stderr)
        return 2

    pairs, warnings = build_exports(conn)
    for w in warnings:
        print(f"# snow_env warning: {w}", file=sys.stderr)

    # Emit a per-developer dev schema derived from the Snowflake user, e.g.
    # user "TGORDONJR" -> DLT_DEV_DATASET=DEV_TGORDONJR. run-sf / dev-run use
    # this when DATASET is not set explicitly, so the sandbox is tied to the
    # developer's Snowflake identity rather than their OS login.
    user = conn.get("user")
    if user:
        safe = re.sub(r"[^A-Z0-9_]", "_", str(user).upper())
        pairs.append(("DLT_DEV_DATASET", f"DEV_{safe}"))

    print(_emit(pairs))
    print(f"# snow_env: sourced connection '{name}'", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
