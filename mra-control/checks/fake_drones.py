"""Runs exported block code against a fake drone and prints, as JSON, every command the drone was sent and when.

Used by python.check.ts, which pipes in the Python that blocks generate. The code runs the way the exported worker
runs it: with `from blocklyTranslations import *` and a groupState of crazyflies and a timeHelper. The ROS and other
libraries blocklyTranslations.py imports aren't installed here, so they're stubbed; nothing it calls in the checks
uses them. The fake drone records commands and stands where it was last sent; the fake clock only adds up waits.
Run: python3 checks/fake_drones.py '[x, y, z]' < code.py (from mra-control; needs numpy)
"""
import json
import pathlib
import sys
import types
from types import SimpleNamespace

import numpy as np

# The templates are imported from src; leave no __pycache__ there
sys.dont_write_bytecode = True
for name in ("rclpy", "rclpy.node", "rowan", "PIL"):
    sys.modules[name] = types.ModuleType(name)
sys.modules["rclpy.node"].Node = lambda name: None
# Only "#rrggbb" to (r, g, b), which is all setLEDColorFromHex asks of it
sys.modules["PIL"].ImageColor = SimpleNamespace(getcolor=lambda hex, mode: tuple(int(hex[i:i + 2], 16) for i in (1, 3, 5)))
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "src/tools/python-templates"))
import blocklyTranslations  # noqa: E402


class FakeClock:
    """Reads like the real clock, in seconds since 1970: at that size a float only resolves about 0.0000002 s, which
    exported code has to cope with (time differences come out slightly off). The waits themselves are added up
    exactly, and that's what's logged."""

    start = 1760000000.123

    def __init__(self):
        self.elapsed = 0.0

    def time(self):
        return self.start + self.elapsed

    def sleep(self, duration):
        self.elapsed += duration

    def sleepForRate(self, rate):
        self.elapsed += 1 / rate

    def sleepUntil(self, time):
        # Like TimeHelper.sleepUntil: a time since the show started
        self.elapsed = max(self.elapsed, time)


class FakeCrazyflie:
    def __init__(self, clock, position):
        self.clock = clock
        self.pos = np.array(position, dtype=float)
        self.log = []

    def record(self, command, **details):
        self.log.append({"t": round(self.clock.elapsed, 6), "command": command, **details})

    def position(self):
        return self.pos.copy()

    def goTo(self, pos, yaw, duration, relative=False):
        self.record("goTo", pos=[float(v) for v in pos], duration=float(duration), relative=bool(relative))
        self.pos = self.pos + np.array(pos, dtype=float) if relative else np.array(pos, dtype=float)

    def cmdPosition(self, pos):
        self.record("cmdPosition", pos=[float(v) for v in pos])
        self.pos = np.array(pos, dtype=float)

    def takeoff(self, height, duration):
        self.record("takeoff", height=float(height), duration=float(duration))
        self.pos[2] = height

    def land(self, height, duration):
        self.record("land", height=float(height), duration=float(duration))
        self.pos[2] = height

    def setLEDColor(self, r, g, b):
        self.record("setLEDColor", color=[r, g, b])

    def notifySetpointsStop(self):
        self.record("notifySetpointsStop")


clock = FakeClock()
drone = FakeCrazyflie(clock, json.loads(sys.argv[1]) if len(sys.argv) > 1 else [0, 0, 0])
names = {name: value for name, value in vars(blocklyTranslations).items() if not name.startswith("_")}
exec(sys.stdin.read(), {**names, "groupState": SimpleNamespace(crazyflies=[drone], timeHelper=clock)})
print(json.dumps({"log": drone.log, "end": round(clock.elapsed, 6)}))
