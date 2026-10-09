"""Checks parametric() from the exported Python against the same numbers as parametric.check.ts.

blocklyTranslations.py imports ROS and drone libraries, so this loads only the parametric code from it.
Run: python3 checks/parametric_check.py (from mra-control; needs numpy)
"""
import ast
import math
import pathlib

import numpy as np

source = pathlib.Path(__file__).parent.parent / "src/tools/python-templates/blocklyTranslations.py"
module = ast.parse(source.read_text())
wanted = {"_parametric_names", "_parametric_function", "parametric"}
nodes = [
    node for node in module.body
    if (isinstance(node, ast.FunctionDef) and node.name in wanted)
    or (isinstance(node, ast.Assign) and any(getattr(target, "id", None) in wanted for target in node.targets))
]
assert len(nodes) == 3, "parametric code not found"


class FakeCrazyflie:
    def __init__(self, position):
        self.start = position
        self.commands = []

    def cmdPosition(self, pos):
        self.commands.append(("cmdPos", np.array(pos)))

    def notifySetpointsStop(self):
        self.commands.append(("stop", None))

    def goTo(self, pos, yaw, duration):
        self.commands.append(("goTo", np.array(pos)))


class FakeTimeHelper:
    def sleepForRate(self, rate):
        pass


namespace = {"np": np, "Hz": 20, "_safe_cf_position": lambda cf: cf.start}
exec(compile(ast.Module(body=nodes, type_ignores=[]), str(source), "exec"), namespace)

cf = FakeCrazyflie([1.0, 2.0, 1.0])
group = type("GroupState", (), {"crazyflies": [cf], "timeHelper": FakeTimeHelper()})()
namespace["parametric"](group, "sin(t)", "sin(2 * t) / 2", "0", 0, 6.28, 8)

positions = [pos for kind, pos in cf.commands if kind == "cmdPos"]
start, end = np.array([1.0, 2.0, 1.0]), np.array([1.0, 2.0, 1.0]) + [math.sin(6.28), math.sin(12.56) / 2, 0]
assert np.allclose(positions[0], start), positions[0]
assert np.allclose(positions[-1], end), positions[-1]
assert len(positions) == 8 * 20 + 1  # 20 Hz for 8 s, plus the exact end point
# Then hands control back and holds the end position
assert [kind for kind, _ in cf.commands[-2:]] == ["stop", "goTo"]
assert np.allclose(cf.commands[-1][1], end)

# Same names as the simulator, including pow
f = namespace["_parametric_function"]("pow(t, 2) + max(0, t - 1) + pi")
assert math.isclose(f(3), 9 + 2 + math.pi)

print("python parametric ok")
