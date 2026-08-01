#!/usr/bin/env python3
"""Record an exact command contract before spawn and its immutable result after exit."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys


ENV_ALLOWLIST = (
    "PATH",
    "DOTNET_ROOT",
    "LANG",
    "LC_ALL",
    "TMPDIR",
    "GODOT_DISPLAY_DRIVER",
    "GODOT_RENDERING_METHOD",
)


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_new_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def write_new_bytes(path: Path, value: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as handle:
        handle.write(value)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--command-id", required=True)
    parser.add_argument("--record-dir", type=Path, required=True)
    parser.add_argument("--stream-dir", type=Path, required=True)
    parser.add_argument("--cwd", type=Path, required=True)
    parser.add_argument("--timeout-seconds", type=float)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()

    command = list(args.command)
    if command[:1] == ["--"]:
        command = command[1:]
    if not command:
        parser.error("missing command after --")

    binary = Path(command[0])
    if not binary.is_absolute() or not binary.is_file():
        raise SystemExit("command binary must be an existing absolute file")
    cwd = args.cwd.resolve(strict=True)
    if not cwd.is_dir():
        raise SystemExit("cwd must be a directory")

    pre_path = args.record_dir / f"{args.command_id}.pre.json"
    result_path = args.record_dir / f"{args.command_id}.result.json"
    stdout_path = args.stream_dir / f"{args.command_id}.stdout"
    stderr_path = args.stream_dir / f"{args.command_id}.stderr"
    for target in (pre_path, result_path, stdout_path, stderr_path):
        if target.exists():
            raise SystemExit(f"refusing to clobber existing command artifact: {target}")

    started_at = utc_now()
    environment = {name: os.environ.get(name, "UNSET") for name in ENV_ALLOWLIST}
    pre_record = {
        "schemaVersion": "new-era-godot-e0-command-pre-v1",
        "status": "SPAWN_PENDING",
        "runId": args.run_id,
        "commandId": args.command_id,
        "orderedArgv": command,
        "cwd": str(cwd),
        "allowlistedEnvironment": environment,
        "binaryPath": str(binary),
        "binarySha256": sha256_file(binary),
        "startedAtUtc": started_at,
        "timeoutSeconds": args.timeout_seconds,
    }
    write_new_json(pre_path, pre_record)

    timed_out = False
    spawn_error: str | None = None
    exit_code: int | None = None
    signal_number: int | None = None
    stdout = b""
    stderr = b""
    try:
        completed = subprocess.run(
            command,
            cwd=cwd,
            env=os.environ.copy(),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=args.timeout_seconds,
            check=False,
        )
        stdout = completed.stdout
        stderr = completed.stderr
        if completed.returncode < 0:
            signal_number = -completed.returncode
        else:
            exit_code = completed.returncode
    except subprocess.TimeoutExpired as exc:
        timed_out = True
        stdout = exc.stdout or b""
        stderr = exc.stderr or b""
    except OSError as exc:
        spawn_error = f"{type(exc).__name__}: {exc}"

    write_new_bytes(stdout_path, stdout)
    write_new_bytes(stderr_path, stderr)
    result = {
        "schemaVersion": "new-era-godot-e0-command-result-v1",
        "status": "COMPLETED" if not timed_out and spawn_error is None else "FAILED_TO_COMPLETE",
        "runId": args.run_id,
        "commandId": args.command_id,
        "preRecordPath": str(pre_path),
        "preRecordSha256": sha256_file(pre_path),
        "endedAtUtc": utc_now(),
        "exitCode": exit_code,
        "signal": signal_number,
        "timedOut": timed_out,
        "spawnError": spawn_error,
        "stdoutPath": str(stdout_path),
        "stdoutBytes": len(stdout),
        "stdoutSha256": sha256_bytes(stdout),
        "stderrPath": str(stderr_path),
        "stderrBytes": len(stderr),
        "stderrSha256": sha256_bytes(stderr),
    }
    write_new_json(result_path, result)

    if spawn_error is not None or timed_out:
        return 125
    if signal_number is not None:
        return 128 + signal_number
    return exit_code if exit_code is not None else 125


if __name__ == "__main__":
    sys.exit(main())

