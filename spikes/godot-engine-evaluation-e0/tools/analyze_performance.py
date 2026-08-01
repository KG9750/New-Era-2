#!/usr/bin/env python3
"""Analyze frozen E0 raw performance samples; standard library only."""

from __future__ import annotations

import json
import math
import pathlib
import statistics
import sys


def percentile_95(values: list[float]) -> float:
    ordered = sorted(values)
    return ordered[math.ceil(0.95 * len(ordered)) - 1]


def analyze(path: pathlib.Path) -> dict:
    raw = json.loads(path.read_text())
    samples = raw["samples"]
    fixture_id = raw["fixture"]["fixtureId"]
    process_ms = [float(row["TIME_PROCESS"]) * 1000.0 for row in samples]
    timestamps = [int(row["monotonicTimestampNs"]) for row in samples]
    elapsed = [float(row["elapsedSeconds"]) for row in samples]
    memory = [int(row["MEMORY_STATIC"]) for row in samples]
    nodes = [int(row["OBJECT_NODE_COUNT"]) for row in samples]
    fps_windows = [sum(1 for value in elapsed if second <= value < second + 1.0) for second in range(10)]
    monotonic = all(b > a for a, b in zip(timestamps, timestamps[1:]))
    frame_indices = [int(row["frameIndex"]) for row in samples]
    unique_frames = len(frame_indices) == len(set(frame_indices))
    baseline_memory = memory[0]
    memory_limit = baseline_memory + max(8 * 1024 * 1024, int(baseline_memory * 0.05))
    thirds = []
    for low, high in ((0.0, 10.0 / 3.0), (10.0 / 3.0, 20.0 / 3.0), (20.0 / 3.0, 10.0)):
        bucket = [memory[i] for i, value in enumerate(elapsed) if low <= value < high]
        thirds.append(statistics.median(bucket))
    memory_trend_fail = thirds[0] < thirds[1] < thirds[2] and thirds[2] - thirds[0] > 8 * 1024 * 1024
    if fixture_id == "nominal":
        long_limit = math.floor(0.01 * len(samples))
        long_count = sum(value > 33.33 for value in process_ms)
        threshold_pass = (
            statistics.median(fps_windows) >= 55
            and percentile_95(process_ms) <= 16.67
            and long_count <= long_limit
        )
    else:
        long_limit = math.floor(0.02 * len(samples))
        long_count = sum(value > 50.0 for value in process_ms)
        threshold_pass = percentile_95(process_ms) <= 33.33 and long_count <= long_limit
    hard_pass = (
        len(samples) >= 120
        and monotonic
        and unique_frames
        and all(math.isfinite(value) for value in process_ms)
        and nodes[-1] == nodes[0]
        and memory[-1] <= memory_limit
        and not memory_trend_fail
    )
    return {
        "schemaVersion": "new-era-godot-e0-performance-summary-v1",
        "source": str(path),
        "fixtureId": fixture_id,
        "sampleCount": len(samples),
        "fpsWindows": fps_windows,
        "medianFps": statistics.median(fps_windows),
        "processP95Ms": percentile_95(process_ms),
        "longFrameCount": long_count,
        "longFrameLimit": long_limit,
        "baselineMemory": baseline_memory,
        "finalMemory": memory[-1],
        "memoryLimit": memory_limit,
        "memoryThirdMedians": thirds,
        "baselineNodeCount": nodes[0],
        "finalNodeCount": nodes[-1],
        "monotonicTimestamps": monotonic,
        "uniqueFrameIndices": unique_frames,
        "hardChecksPass": hard_pass,
        "thresholdsPass": threshold_pass,
        "status": "PASS" if hard_pass and threshold_pass else "FAIL",
    }


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit("usage: analyze_performance.py INPUT.json OUTPUT.json")
    result = analyze(pathlib.Path(sys.argv[1]))
    pathlib.Path(sys.argv[2]).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
