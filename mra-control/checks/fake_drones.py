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

for name in ("rclpy", "rclpy.node", "rowan", "scipy", "scipy.spatial", "scipy.spatial.transform", "PIL"):
    sys.modules[name] = types.ModuleType(name)
sys.modules["rclpy.node"].Node = lambda name: None
sys.modules["scipy.spatial.transform"].Rotation = None
sys.modules["PIL"].ImageColor = None
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "src/tools/python-templates"))
import blocklyTranslations  # noqa: E402


class FakeClock:
    def __init__(self):
        self.now = 0.0

    def time(self):
        return self.now

    def sleep(self, duration):
        self.now += duration

    def sleepForRate(self, rate):
        self.now += 1 / rate

    def sleepUntil(self, time):
        self.now = max(self.now, time)


class FakeCrazyflie:
    def __init__(self, clock, position):
        self.clock = clock
        self.pos = np.array(position, dtype=float)
        self.log = []

    def record(self, command, **details):
        self.log.append({"t": round(self.clock.now, 6), "command": command, **details})

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
print(json.dumps({"log": drone.log, "end": round(clock.now, 6)}))
