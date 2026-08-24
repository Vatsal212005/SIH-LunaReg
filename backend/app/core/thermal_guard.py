\
from __future__ import annotations

import subprocess
import time
from dataclasses import dataclass


class ThermalSafetyError(RuntimeError):
    pass


@dataclass
class GPUState:
    temperature_c: float
    memory_used_mb: float
    memory_total_mb: float
    power_w: float | None = None


def query_nvidia_gpu() -> GPUState | None:
    """Return the first NVIDIA GPU state, or None when nvidia-smi is unavailable."""
    fields = "temperature.gpu,memory.used,memory.total,power.draw"
    try:
        proc = subprocess.run(
            [
                "nvidia-smi",
                f"--query-gpu={fields}",
                "--format=csv,noheader,nounits",
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=8,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None

    if proc.returncode != 0 or not proc.stdout.strip():
        return None

    line = proc.stdout.strip().splitlines()[0]
    parts = [p.strip() for p in line.split(",")]
    if len(parts) < 3:
        return None

    def _f(value: str) -> float | None:
        try:
            return float(value)
        except ValueError:
            return None

    temperature = _f(parts[0])
    memory_used = _f(parts[1])
    memory_total = _f(parts[2])
    power = _f(parts[3]) if len(parts) > 3 else None
    if temperature is None or memory_used is None or memory_total is None:
        return None

    return GPUState(
        temperature_c=temperature,
        memory_used_mb=memory_used,
        memory_total_mb=memory_total,
        power_w=power,
    )


def wait_until_safe(
    *,
    trigger_c: float = 78.0,
    resume_c: float = 74.0,
    hard_stop_c: float = 84.0,
    timeout_s: float = 300.0,
    poll_s: float = 10.0,
    label: str = "GPU",
) -> GPUState | None:
    """
    Prevent LunaReg from starting a learned matcher while the GPU is already hot.
    This is a conservative software guard, not a replacement for hardware thermal protection.
    """
    state = query_nvidia_gpu()
    if state is None:
        return None

    if state.temperature_c >= hard_stop_c:
        raise ThermalSafetyError(
            f"{label} is already at {state.temperature_c:.0f} C, above the "
            f"{hard_stop_c:.0f} C LunaReg hard-start limit. Let the laptop cool first."
        )

    if state.temperature_c < trigger_c:
        return state

    print(
        f"      Thermal guard: {state.temperature_c:.0f} C. "
        f"Waiting until <= {resume_c:.0f} C before starting {label}..."
    )
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        time.sleep(poll_s)
        state = query_nvidia_gpu()
        if state is None:
            return None
        print(f"      GPU temperature: {state.temperature_c:.0f} C")
        if state.temperature_c <= resume_c:
            return state
        if state.temperature_c >= hard_stop_c:
            # We are not running a model while waiting, so keep waiting safely.
            continue

    raise ThermalSafetyError(
        f"GPU did not cool to {resume_c:.0f} C within {timeout_s:.0f} seconds. "
        "Benchmark stopped instead of adding more thermal load."
    )
