/* eslint-disable react/no-unknown-property */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Crazyflie } from '@MRAControl/components/vector/Crazyflie';
import { useRobartState } from '@MRAControl/state/useRobartState';
import { useSimulator } from '@MRAControl/state/useSimulator';
import { useUIState } from '@MRAControl/state/useUIState';
import { CatmullRomLine, GizmoHelper, GizmoViewport, Grid, Line, OrbitControls, Plane, Sphere } from '@react-three/drei';
import { noGroupColor, robotGroup } from '@MRAControl/state/groupMigration';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import React from 'react';
import type THREE from 'three';
import { type Group, type PerspectiveCamera, type Vector3 } from 'three';
import { panView } from './trackpad';

let init = true;

// The 12 edges of the box between two corners, as pairs of points
const boxEdges = (min: number[], max: number[]) => {
	const corner = (i: number): [number, number, number] => [i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]];
	// Each corner joined to the corners one axis away from it
	return [0, 1, 2, 3, 4, 5, 6, 7].flatMap((i) => [1, 2, 4].filter((axis) => !(i & axis)).flatMap((axis) => [corner(i), corner(i | axis)]));
};
export const Simulation = () => {
	const marker = useRef<Group>(null!);
	const robots = useSimulator((state) => state.robots);
	const robartRobots = useRobartState((state) => state.robots);
	const setRobots = useSimulator((state) => state.setRobots);
	const robartState = useRobartState();
	const simulatorState = useSimulator();
	const renderBB = simulatorState.renderBoundingBoxes;
	// Built once per change: a new outline each render (every frame while playing) rebuilt its geometry every frame
	const workAreaEdges = useMemo(() => boxEdges(robartState.limits.workAreaMin, robartState.limits.workAreaMax), [robartState.limits]);

	const trajectoryMarkers: Array<{ position: Vector3; color: THREE.Color; id: string }> = useSimulator((state) => state.trajectoryMarkers);

	if (Object.keys(robots).length !== 0) {
		if (simulatorState.time === 0) {
			Object.values(robots).forEach((robot) => {
				// Skip robots that were just deleted; the simulator's list catches up right after
				const startingPosition = robartState.robots[robot.id]?.startingPosition;
				if (startingPosition) robot.pos.set(...startingPosition);
			});
		}

	} else {
		if (Object.keys(robartRobots).length !== 0) {
			setRobots(robartRobots);
		}
	}

	const { size, viewport, camera, gl } = useThree();
	const controls = useRef<React.ElementRef<typeof OrbitControls>>(null!);
	// Trackpad: two-finger scrolling pans, pinching (ctrl+wheel; gesture events in Safari) and cmd+scrolling zoom
	useEffect(() => {
		const canvas = gl.domElement;
		const zoom = (scale: number) => {
			const {target} = controls.current;
			camera.position.sub(target).multiplyScalar(scale).add(target);
			controls.current.update();
		};

		const onWheel = (event: WheelEvent) => {
			event.preventDefault(); // Otherwise the page scrolls or zooms
			const lines = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;
			if (event.ctrlKey || event.metaKey) {
				zoom(Math.exp(Math.max(-0.2, Math.min(0.2, event.deltaY * lines * 0.01))));
			} else {
				// Half of moving 1:1 with the fingers at the default speed
				const speed = lines * 0.5 * useUIState.getState().panSpeed;
				panView(camera as PerspectiveCamera, controls.current.target, event.deltaX * speed, event.deltaY * speed, canvas.clientHeight);
				controls.current.update();
			}
		};

		let previousScale = 1;
		const onGestureStart = (event: Event) => {
			event.preventDefault();
			previousScale = 1;
		};

		const onGestureChange = (event: Event) => {
			event.preventDefault();
			const {scale} = event as Event & {scale: number};
			zoom(previousScale / scale);
			previousScale = scale;
		};

		canvas.addEventListener('wheel', onWheel, {passive: false});
		canvas.addEventListener('gesturestart', onGestureStart);
		canvas.addEventListener('gesturechange', onGestureChange);
		return () => {
			canvas.removeEventListener('wheel', onWheel);
			canvas.removeEventListener('gesturestart', onGestureStart);
			canvas.removeEventListener('gesturechange', onGestureChange);
		};
	}, [gl, camera]);
	// if (init || camera.up !== new THREE.Vector3(0, 0, 1)) {
	if (init || (camera.up.x !== 0 || camera.up.y !== 0 || camera.up.z !== 1)) {
		camera.position.set(-5, 0, 2);
		camera.up.set(0, 0, 1);
		init = false;
	}

	return (
		<>
			<color attach="background" args={['black']} />
			{/* No object={camera} (the camera is the default): drei passes object on and it replaced the controls, so every
			    setting here, from turning off the wheel zoom to angle and distance limits, went to the camera and did nothing.
			    The limits are left off and damping is off, as the view has always behaved. */}
			<OrbitControls ref={controls} enableZoom={false} enableDamping={false} />
			{/* <FlyControls></FlyControls> */}
			<GizmoHelper alignment="bottom-right" margin={[80, 80]}>
				<GizmoViewport labels={['X', 'Y', 'Z']} axisColors={['#9d4b4b', '#2f7f4f', '#3b5b9d']} labelColor="white" />
			</GizmoHelper>
			<Grid
				position={[0, 0, -0.001]}
				args={[10.5, 10.5]}
				cellSize={1}
				cellThickness={1}
				rotation={[0, -Math.PI / 2, -Math.PI / 2]}
				cellColor={'black'}
				fadeDistance={50}
				fadeStrength={1.2}
				infiniteGrid={true}
			/>
			<Plane args={[1000, 1000]} rotation={[0, 0, -Math.PI / 2]} position={[0, 0, -0.02]}>
				<meshStandardMaterial color="black" />
			</Plane>
			{Object.values(robots).map((robot) => (
				<group key={robot.id} ref={marker} position={robot.pos}>
					<Crazyflie robotId={robot.id} renderBoundingBox={renderBB} />

				</group>
			))}
			{simulatorState.showWorkArea && <Line points={workAreaEdges} segments color="white" lineWidth={1} transparent opacity={0.5} />}
			{/* Each robot's whole planned flight, in its group's color; drones that never move have no line */}
			{simulatorState.showPaths && Object.entries(simulatorState.plannedPaths)
				.filter(([, points]) => points.some((point) => !point.equals(points[0])))
				.map(([robotId, points]) => (
					<Line
						key={`path-${robotId}`}
						points={points}
						color={robotGroup(robartState.timelineState.groups, robotId)?.color ?? noGroupColor}
						lineWidth={1.5}
						transparent
						opacity={0.6}
					/>
				))}
			{simulatorState.showTrails && trajectoryMarkers.map((trajectoryMarker) => (
				<group key={trajectoryMarker.id} position={trajectoryMarker.position}>
					<Sphere args={[0.03]}>
						<meshBasicMaterial color={[trajectoryMarker.color.r / 255, trajectoryMarker.color.g / 255, trajectoryMarker.color.b / 255]} />
					</Sphere>
				</group>
			))}

			<primitive object={camera}></primitive>
		</>
	);
};
