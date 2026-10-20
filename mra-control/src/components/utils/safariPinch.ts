// Safari reports trackpad pinches as gesture events instead of ctrl+wheel. Calls onPinch with how much the pinch grew
// since the last event (above 1: fingers spreading) and where it is. Returns the cleanup.
export const onSafariPinch = (element: HTMLElement, onPinch: (ratio: number, clientX: number, clientY: number) => void) => {
	let previousScale = 1;
	const onGestureStart = (event: Event) => {
		event.preventDefault(); // Otherwise Safari zooms the whole page
		previousScale = 1;
	};

	const onGestureChange = (event: Event) => {
		event.preventDefault();
		const {scale, clientX, clientY} = event as Event & {scale: number; clientX: number; clientY: number};
		onPinch(scale / previousScale, clientX, clientY);
		previousScale = scale;
	};

	element.addEventListener('gesturestart', onGestureStart);
	element.addEventListener('gesturechange', onGestureChange);
	return () => {
		element.removeEventListener('gesturestart', onGestureStart);
		element.removeEventListener('gesturechange', onGestureChange);
	};
};
