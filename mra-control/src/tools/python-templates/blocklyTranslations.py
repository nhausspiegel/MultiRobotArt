from collections import namedtuple
from types import SimpleNamespace
import numpy as np
from PIL import ImageColor
import rclpy
import random
import time
from crazyflieLoggers import *
import rowan
from scipy.spatial.transform import Rotation as R

import traceback

Hz = 20


def _safe_cf_position(cf, retries=50, retry_sleep=0.01):
    """
    Read Crazyflie position robustly while ROS pose callbacks are catching up.
    """
    last_error = None
    for _ in range(retries):
        try:
            return cf.position()
        except ValueError as e:
            # Seen when pose cache is temporarily empty:
            # "need at least one array to concatenate"
            last_error = e
            time.sleep(retry_sleep)
    if last_error is not None:
        raise last_error
    return cf.position()

###
#  Landing/Takeoff commands
###


def takeoff(groupState, height=1.0, duration=2.0):
    """Takeoff command, runs for every crazyflie in groupState

    Args:
        groupState GroupState: crazyflies and timehelper objects
        height (float, optional): height to takeoff to. Defaults to 1.0.
        duration (float, optional): duration of command. Defaults to 2.0.
    """
    timeHelper = groupState.timeHelper
    crazyflies = groupState.crazyflies
    for cf in crazyflies:
        cf.takeoff(float(height), float(duration))
    timeHelper.sleep(duration)


def land(groupState, height=0.04, duration=2.0):
    """Land command, runs for every crazyflie in groupState

    Args:
        groupState GroupState: crazyflies and timehelper objects
        height (float, optional): height to land to. Defaults to 1.0.
        duration (float, optional): duration of command. Defaults to 2.0.
    """
    timeHelper = groupState.timeHelper
    crazyflies = groupState.crazyflies
    for cf in crazyflies:
        cf.land(float(height), float(duration))
    timeHelper.sleep(duration)


###
#  Motion Primitive Commands
###


def goto_velocity(groupState, x, y, z, v, rel=False):
    """goTo command at a given *average* velocity, runs for every crazyflie in groupState

    Args:
        groupState GroupState: crazyflies and timehelper objects
        x float: Desired x position
        y float: Desired y position
        z float: Desired z position
        v float: Desired average velocity
        rel (bool, optional): Whether or not the command is relative or absolute. Defaults to False.
    """
    timeHelper = groupState.timeHelper
    crazyflies = groupState.crazyflies
    max_duration = 0
    for cf in crazyflies:
        # try:
        #     if not isinstance(cf, CrazyflieSimLogger):
        #         rclpy.spin_once(cf.node)
        # except Exception:
        #     cf.node.get_logger().error(traceback.format_exc())
        #     pass
        curr_pos = cf.position()
        dist = np.linalg.norm(np.array(curr_pos) - np.array([x, y, z]))
        duration = dist / v
        cf.goTo((float(x), float(y), float(z)), 0, duration=duration, relative=rel)
        max_duration = max(duration, max_duration)
    timeHelper.sleep(max_duration)


def goto_duration(groupState, x, y, z, duration, rel=False):
    """goTo command at a given duration, runs for every crazyflie in groupState

    Args:
        groupState GroupState: crazyflies and timehelper objects
        x float: Desired x position
        y float: Desired y position
        z float: Desired z position
        duration float: duration of command
        rel (bool, optional): Whether or not the command is relative or absolute. Defaults to False.
    """
    timeHelper = groupState.timeHelper
    crazyflies = groupState.crazyflies
    for cf in crazyflies:
        cf.goTo((float(x), float(y), float(z)), 0, duration=duration, relative=rel)
    timeHelper.sleep(duration)


def goto_velocity_relative_position(groupState, x, y, z, v):
    """goTo command with given average velocity and relative position

    Args:
        groupState GroupState: crazyflies and timehelper objects
        x float: Desired x position
        y float: Desired y position
        z float: Desired z position
        v float: average velocity
    """
    distance = np.linalg.norm((x, y, z))
    time = distance / v
    # time *= 2
    crazyflies = groupState.crazyflies
    timeHelper = groupState.timeHelper
    for cf in crazyflies:
        cf.goTo((float(x), float(y), float(z)), 0.0, time, relative=True)
    timeHelper.sleep(time)


def goto_duration_relative(groupState, x, y, z, duration):
    goto_duration(groupState, x, y, z, duration, True)


def move_direction(groupState, direction, distance, duration):
    timeHelper = groupState.timeHelper
    crazyflies = groupState.crazyflies
    for cf in crazyflies:
        pos = cf.getPosition()
        if direction == "up":
            cf.goTo((0, 0, distance), 0, duration, relative=True)
        elif direction == "forward":
            cf.goTo((distance, 0, 0), 0, duration=duration, relative=True)
        elif direction == "backward":
            cf.goTo((-distance, 0, 0), 0, duration=duration, relative=True)
        elif direction == "down":
            cf.goTo((0, 0, -distance), 0, duration, relative=True)
    timeHelper.sleep(duration)
    return duration


def hover(groupState, duration):
    """Hover in place: the crazyflies already hold their last position, so just wait"""
    groupState.timeHelper.sleep(duration)


# The old "stop and hover" block's code, still in projects saved before it became "hover for N seconds"
def stop_and_hover(groupState, height=None):
    crazyflies = groupState.crazyflies
    for cf in crazyflies:
        position = cf.position()
        cf.goTo(position, 0, 1.0)


###
#  Low Level Commands...
###
def getPosition(cf):
    return cf.position()


# TODO: Enable low level commands...
def cmdPosition(cf, pos):
    cf.cmdPosition(pos)


def enableHighLevelCommander(cf):
    cf.notifySetpointsStop()


###
# Colors
###


def setLEDColorFromHex(groupState, hex):
    # return
    crazyflies = groupState.crazyflies
    rgb = ImageColor.getcolor(hex, "RGB")
    for cf in crazyflies:
        cf.setLEDColor(*rgb)


def setLEDColor(groupState, r, g, b):
    # return
    crazyflies = groupState.crazyflies
    for cf in crazyflies:
        cf.setLEDColor(r, g, b)


def setRandomLEDColor(groupState):
    # One random color for the whole group, like the simulator
    setLEDColor(groupState, random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))


###
#  Trajectory commands...
###
def circle(groupState, radius, velocity, radians, direction):
    crazyflies = groupState.crazyflies
    timeHelper = groupState.timeHelper
    clockwise = 1
    if direction == "ccw":
        clockwise = -1

    # velocity is the speed along the circle (m/s), as in the simulator, so the turn rate depends on the radius
    angular_velocity = velocity / radius

    fx = lambda t: 0
    fy = lambda t: radius * (np.cos(t * angular_velocity) - 1)
    fz = lambda t: clockwise * radius * np.sin(t * angular_velocity)

    timesteps = np.arange(0, radians / angular_velocity, 1 / Hz)

    # start positions bumped up by 1 meter in z
    initialPositions = [
        (pos[0], pos[1], pos[2]) if len(pos) >= 3 else pos
        for pos in (cf.position() for cf in crazyflies)
    ]
    for t in timesteps:
        for initPos, cf in zip(initialPositions, crazyflies):
            pos = np.array([fx(t), fy(t), fz(t)])
            pos += np.array(initPos)
            cf.cmdPosition(pos)
        timeHelper.sleepForRate(Hz)

    # for cf in crazyflies:
    #     cf.notifySetpointsStop()


# Names parametric expressions can use; same as the simulator (parametricScope in trajectories.ts)
_parametric_names = {
    "sin": np.sin, "cos": np.cos, "tan": np.tan, "asin": np.arcsin, "acos": np.arccos, "atan": np.arctan,
    "atan2": np.arctan2, "sinh": np.sinh, "cosh": np.cosh, "tanh": np.tanh, "sqrt": np.sqrt, "abs": np.abs,
    "exp": np.exp, "log": np.log, "pow": np.power, "floor": np.floor, "ceil": np.ceil, "min": min, "max": max,
    "pi": np.pi, "e": np.e,
}


def _parametric_function(expression):
    code = compile(expression, "<parametric>", "eval")

    def f(t):
        # Like the simulator: a value that can't be computed (log(0), sqrt of a negative, overflow) is 0. errstate also
        # keeps numpy from warning, which fails under the empty builtins.
        try:
            with np.errstate(all="ignore"):
                value = float(eval(code, {"__builtins__": {}}, {**_parametric_names, "t": t}))
        except (ArithmeticError, ValueError):
            return 0.0
        return value if np.isfinite(value) else 0.0

    return f


def parametric(groupState, x, y, z, start_t, end_t, duration):
    """Flies the path (x(t), y(t), z(t)) for t from start_t to end_t over `duration` seconds, shifted so it starts
    where each drone is. Streams positions like circle(), then hands control back to the high-level commander."""
    crazyflies = groupState.crazyflies
    timeHelper = groupState.timeHelper
    functions = [_parametric_function(expression) for expression in (x, y, z)]
    path_at = lambda t: np.array([f(t) for f in functions])
    path_start = path_at(start_t)
    initialPositions = [np.array(_safe_cf_position(cf), dtype=float) for cf in crazyflies]

    for elapsed in list(np.arange(0, duration, 1 / Hz)) + [duration]:
        offset = path_at(start_t + (end_t - start_t) * elapsed / duration) - path_start
        for initPos, cf in zip(initialPositions, crazyflies):
            cf.cmdPosition(initPos + offset)
        timeHelper.sleepForRate(Hz)

    # Like execute_commands: stop streaming, then hold the end position with the high-level commander
    for initPos, cf in zip(initialPositions, crazyflies):
        cf.notifySetpointsStop()
        cf.goTo(initPos + path_at(end_t) - path_start, 0, 2.0)


# Trajectory Modifiers...


def negate(groupState, command):
    originalGroupState = groupState
    simCrazyflies = []
    for cf in groupState.crazyflies:
        # try:
        #     if not isinstance(cf, CrazyflieSimLogger):
        #         rclpy.spin_once(cf.node)
        # except Exception:
        #     cf.node.get_logger().error(traceback.format_exc())
        simCrazyflies.append(CrazyflieSimLogger(cf.position()))
    simTimeHelper = TimeHelperSimLogger()
    simTimeHelper.currTime = originalGroupState.timeHelper.time()
    groupState = SimpleNamespace(crazyflies=simCrazyflies, timeHelper=simTimeHelper)
    # Execute Simulated Commands
    command(groupState)
    # Process commands to add startTime
    setStartTimes(groupState)
    # negate every command
    for simcf, cf in zip(groupState.crazyflies, originalGroupState.crazyflies):
        # try:
        #     rclpy.spin_once(cf.node)
        # except Exception:
        #     cf.node.get_logger().error(traceback.format_exc())
        #     print('negate2')
        #     pass
        initialPosition = cf.position()
        for i, command in enumerate(simcf.commands):
            cfCommand = command.command
            if (
                cfCommand == "goTo"
                or cfCommand == "cmdPos"
                or cfCommand == "takeoff"
                or cfCommand == "land"
            ):
                # Negate the direction (Note, do not negate land...)
                if command.relative == False:
                    originalDestination = command.position
                    # (Start - goal) gives, vector from start, so add back starting position for 2*start - goal
                    negatedDestination = 2 * np.array(initialPosition) - np.array(
                        originalDestination
                    )
                    simcf.commands[i].position = negatedDestination
                    # print(negatedDestination, originalDestination, initialPosition)
                else:
                    originalDestination = command.position
                    negatedDestination = -originalDestination
                    simcf.commands[i].position = negatedDestination
            else:
                # Just run the original command, no need to alter anything
                pass
    execute_commands(groupState, originalGroupState)


def rotate(groupState, command, x_rot, y_rot, z_rot):
    simGroupState = simCommand(groupState, command)
    while x_rot > np.pi:
        x_rot -= 2 * np.pi
    while y_rot > np.pi:
        y_rot -= 2 * np.pi
    while z_rot > 2 * np.pi:
        z_rot -= 2 * np.pi
    r = R.from_euler("xyz", (x_rot, y_rot, z_rot), degrees=False)

    for simcf, cf in zip(simGroupState.crazyflies, groupState.crazyflies):
        # try:
        #     if not isinstance(cf, CrazyflieSimLogger):
        #         rclpy.spin_once(cf.node)
        # except Exception:
        #     cf.node.get_logger().error(traceback.format_exc())
        initialPosition = cf.position()
        for i, command in enumerate(simcf.commands):
            cfCommand = command.command
            if cfCommand == "goTo" or cfCommand == "cmdPos":
                if command.relative == False:
                    originalDestination = command.position
                    directionVector = np.array(originalDestination) - np.array(
                        initialPosition
                    )
                    rotatedVector = r.apply(directionVector)
                    # rotQuat = rowan.from_euler(x_rot, y_rot, z_rot, convention='xyz')
                    # rotatedVector = rowan.rotate(rotQuat, directionVector)
                    newDestination = rotatedVector + initialPosition
                    simcf.commands[i].position = newDestination
                else:
                    originalDestination = command.position
                    directionVector = np.array(originalDestination)
                    # rotQuat = rowan.from_euler(x_rot, y_rot, z_rot, convention='xyz')
                    # rotatedVector = rowan.rotate(rotQuat, directionVector)
                    rotatedVector = r.apply(directionVector)
                    newDestination = rotatedVector
                    simcf.commands[i].position = newDestination
            else:
                # Just run the original command, no need to alter anything
                pass
    execute_commands(simGroupState, groupState)


def translate(groupState, command, x, y, z, speed=0.5):
    """Runs command shifted by (x, y, z) meters.

    The drones first fly to the shifted start in a straight line at `speed` m/s, so the shifted path doesn't begin
    with a jump. The simulator does the same (TranslationTrajectory).
    """
    simGroupState = simCommand(groupState, command)
    offset = np.array([x, y, z], dtype=float)
    distance = float(np.linalg.norm(offset))
    if distance > 0:
        duration = distance / speed
        for cf in groupState.crazyflies:
            cf.goTo(np.array(_safe_cf_position(cf), dtype=float) + offset, 0, duration)
        groupState.timeHelper.sleep(duration)

    for simcf in simGroupState.crazyflies:
        for recorded in simcf.commands:
            if recorded.command in ("goTo", "cmdPos") and not recorded.relative:
                recorded.position = np.array(recorded.position, dtype=float) + offset
    execute_commands(simGroupState, groupState)

def stretchTrajectory(
    groupState, command, x_stretch, y_stretch, z_stretch, time_stretch
):
    simGroupState = simCommand(groupState, command)
    for simcf, cf in zip(simGroupState.crazyflies, groupState.crazyflies):
        # try:
        #     if not isinstance(cf, CrazyflieSimLogger):
        #         rclpy.spin_once(cf.node)
        # except Exception:
        #     cf.node.get_logger().error(traceback.format_exc())
        initialPosition = cf.position()
        for i, command in enumerate(simcf.commands):
            cfCommand = command.command
            if (
                cfCommand == "goTo"
                or cfCommand == "cmdPos"
                or cfCommand == "takeoff"
                or cfCommand == "land"
            ):
                if command.relative == False:
                    originalDestination = command.position
                    directionVector = np.array(originalDestination) - np.array(
                        initialPosition
                    )
                    stretchedVector = np.multiply(
                        directionVector, (x_stretch, y_stretch, z_stretch)
                    )  # directionVector.multiply(np.array((x_stretch, y_stretch, z_stretch)))
                    newDestination = stretchedVector + initialPosition
                    simcf.commands[i].position = newDestination
                    simcf.commands[i].duration *= time_stretch
                else:
                    originalDestination = command.position
                    directionVector = np.array(initialPosition) - np.array(
                        originalDestination
                    )
                    newDestination = np.multiply(
                        directionVector, (x_stretch, y_stretch, z_stretch)
                    )
                    simcf.commands[i].position = newDestination
                    simcf.commands[i].duration *= time_stretch
            else:
                # Just run the original command, no need to alter anything
                pass
    execute_commands(simGroupState, groupState)


def simCommand(originalGroupState, command):
    simCrazyflies = []
    for cf in originalGroupState.crazyflies:
        # try:
        #     if not isinstance(cf, CrazyflieSimLogger):
        #         rclpy.spin_once(cf.node)
        # except Exception:
        #     cf.node.get_logger().error(traceback.format_exc())
        simCrazyflies.append(CrazyflieSimLogger(_safe_cf_position(cf)))
    simTimeHelper1 = TimeHelperSimLogger()
    simTimeHelper1.currTime = originalGroupState.timeHelper.time()
    simGroupState = SimpleNamespace(crazyflies=simCrazyflies, timeHelper=simTimeHelper1)
    # Execute Simulated Commands
    command(simGroupState)

    # Reset position
    for cf in simGroupState.crazyflies:
        cf.currPosition = cf.initialPosition

    setStartTimes(simGroupState)
    return simGroupState


def _recorded_path(simCF, start):
    """A stand-in crazyflie's recorded commands (see simCommand) as one path, like a simulator Trajectory: its duration
    and its position at any time. Go-tos, takeoffs and landings follow the same degree 7 polynomial as the firmware and
    the simulator (robotGoTo); each streamed position is held for its step."""
    segments = []
    position = np.array(start, dtype=float)
    elapsed = 0.0
    for command in simCF.commands:
        if command.command == "goTo":
            goal = np.array(command.position, dtype=float) + (position if command.relative else 0)
        elif command.command in ("takeoff", "land"):
            goal = np.array([position[0], position[1], command.height], dtype=float)
        elif command.command == "cmdPos":
            goal = np.array(command.position, dtype=float)
        else:
            continue  # LED changes and mode switches don't move the drone
        if command.duration > 0:
            if command.command == "cmdPos":
                segments.append((elapsed, command.duration, lambda t, goal=goal: goal))
            else:
                polynomials = [goToPolynomial(command.duration, p, 0, 0, g, 0, 0) for p, g in zip(position, goal)]
                segments.append((elapsed, command.duration, lambda t, fs=polynomials: np.array([f(t) for f in fs])))
            elapsed += command.duration
        position = goal

    def position_at(t):
        for segment_start, duration, segment in segments:
            if t < segment_start + duration:
                return segment(t - segment_start)
        return position

    return elapsed, position_at


def addTrajectories(groupState, command1, command2, add=True):
    """Flies command1 and command2 at the same time, adding up their movements, or subtracting command2's when add is
    False. Mirrors the simulator's AddTrajectories (trajectories.ts): start + movement of 1 +/- movement of 2, with the
    shorter one stretched to last as long as the longer one. Streams positions like parametric(), then hands control
    back to the high-level commander and holds the end."""
    crazyflies = groupState.crazyflies
    timeHelper = groupState.timeHelper
    starts = [np.array(_safe_cf_position(cf), dtype=float) for cf in crazyflies]
    paths1 = [_recorded_path(simCF, start) for simCF, start in zip(simCommand(groupState, command1).crazyflies, starts)]
    paths2 = [_recorded_path(simCF, start) for simCF, start in zip(simCommand(groupState, command2).crazyflies, starts)]
    duration = max([path_duration for path_duration, _ in paths1 + paths2], default=0.0)
    if duration <= 0:
        return
    sign = 1 if add else -1

    def position_at(start, path1, path2, fraction):
        (duration1, at1), (duration2, at2) = path1, path2
        return start + (at1(fraction * duration1) - start) + sign * (at2(fraction * duration2) - start)

    drones = list(zip(crazyflies, starts, paths1, paths2))
    # Counted in whole steps: np.arange can add a step through rounding (12.6 / 0.05 = 252.00000000000003)
    for step in range(int(np.ceil(duration * Hz - 1e-9))):
        for cf, start, path1, path2 in drones:
            cf.cmdPosition(position_at(start, path1, path2, step / Hz / duration))
        timeHelper.sleepForRate(Hz)
    for cf, start, path1, path2 in drones:
        end = position_at(start, path1, path2, 1.0)
        cf.cmdPosition(end)
        cf.notifySetpointsStop()
        cf.goTo(end, 0, 2.0)


def goToPolynomial(T, p, v, a, p2, v2, a2):
    poly = [0] * 8

    # Taken from crazyflie Firmware Library
    T2 = T * T
    T3 = T2 * T
    T4 = T3 * T
    T5 = T4 * T
    T6 = T5 * T
    T7 = T6 * T
    poly[0] = p
    poly[1] = v
    poly[2] = a / 2
    poly[3] = 0
    poly[4] = -(
        5 * (14 * p - 14 * p2 + 8 * T * v + 6 * T * v2 + 2 * T2 * a - T2 * a2)
    ) / (2 * T4)
    poly[5] = (
        84 * p - 84 * p2 + 45 * T * v + 39 * T * v2 + 10 * T2 * a - 7 * T2 * a2
    ) / T5
    poly[6] = -(
        140 * p - 140 * p2 + 72 * T * v + 68 * T * v2 + 15 * T2 * a - 13 * T2 * a2
    ) / (2 * T6)
    poly[7] = (2 * (10 * p - 10 * p2 + 5 * T * v + 5 * T * v2 + T2 * a - T2 * a2)) / T7
    return lambda t: sum([poly[i] * t**i for i in range(len(poly))])


def subtractTrajectories(groupState, command1, command2, add=False):
    """Like addTrajectories, subtracting command2's movement. The block passes add=False; it's ignored."""
    addTrajectories(groupState, command1, command2, add=False)


def execute_commands(simGroupState, originalGroupState):
    # Note, assumes all crazyflies in group are issued similar commands (all are told goTo)
    # Assumes first command is to be executed immediately
    # If not the case, different groups should be used
    commandsForSingleCF = simGroupState.crazyflies[0].commands
    highLevel = True
    for i, command in enumerate(commandsForSingleCF):
        if highLevel and command.command == "cmdPos":
            highLevel = False
        if not highLevel and command.command != "cmdPos":
            highLevel = True
            # for realCF in originalGroupState.crazyflies:
            #     realCF.notifySetpointsStop()
            # realCF.goTo(realCF.position(), 0, 0.5)
        for simCF, realCF in zip(
            simGroupState.crazyflies, originalGroupState.crazyflies
        ):
            execute_single_command(simCF.commands[i], realCF)
        originalGroupState.timeHelper.sleep(command.duration)
    if not highLevel:
        for realCF in originalGroupState.crazyflies:
            realCF.notifySetpointsStop()
        # originalGroupState.timeHelper.sleep(0.1)
        for realCF in originalGroupState.crazyflies:
            realCF.goTo(realCF.position(), 0, 2.00)
            # realCF.setLEDColor(0, 0, 0.5)


def execute_single_command(command, crazyflie):
    if command.command == "goTo":
        crazyflie.goTo(
            command.position, command.yaw, command.duration, command.relative
        )
    elif command.command == "cmdPos":
        # print(command.position)
        crazyflie.cmdPosition(command.position)
    elif command.command == "takeoff":
        crazyflie.takeoff(command.height, command.duration)
    elif command.command == "land":
        crazyflie.land(command.height, command.duration)
    elif command.command == "setLEDColor":
        crazyflie.setLEDColor(*command.color)
    elif command.command == "position":
        pass
    elif command.command == "notifySetpointsStop":
        crazyflie.notifySetpointsStop()
        pass
