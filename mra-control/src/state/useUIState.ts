/* eslint-disable @typescript-eslint/naming-convention */
import {create} from 'zustand';

export type UIState = {
	settingsModalOpen: boolean;
	curveEditorOpen: boolean;
	openSimulation: boolean;
	/**
   * Drone whose window is open (opened by clicking its name tag on the timeline).
   */
	editingRobotId: string | undefined;
	/**
   * Two-finger scroll pan speed; 1 is the default, half of moving 1:1 with the fingers.
   */
	panSpeed: number;
};

export type UIActions = {
	toggleSettingsModal: () => void;
	toggleCurveEditor: () => void;
	setEditingRobotId: (robotId: string | undefined) => void;
	toggleSimulation: () => void;
	setPanSpeed: (panSpeed: number) => void;
};

export type UIStoreState = UIState & UIActions;

// The pan speed is remembered in this browser for every project, and not saved in project files
const panSpeedKey = 'mra-pan-speed';
const savedPanSpeed = () => {
	try {
		const panSpeed = Number(localStorage.getItem(panSpeedKey));
		return panSpeed > 0 ? panSpeed : 1;
	} catch {
		return 1;
	}
};

/**
 * Store for UI state, not saved in project files.
 */
export const useUIState = create<UIStoreState>()((set, get) => ({
	settingsModalOpen: false,
	curveEditorOpen: false,
	openSimulation: false,
	editingRobotId: undefined,
	panSpeed: savedPanSpeed(),
	toggleSettingsModal: () => {
		set({settingsModalOpen: !get().settingsModalOpen}); 
	},
	toggleCurveEditor: () => {
		set({curveEditorOpen: !get().curveEditorOpen}); 
	},
	setEditingRobotId: (robotId) => {
		set({editingRobotId: robotId});
	},
	toggleSimulation: () => {
		set({openSimulation: !get().openSimulation});
	},
	setPanSpeed: (panSpeed) => {
		set({panSpeed});
		try {
			localStorage.setItem(panSpeedKey, String(panSpeed));
		} catch {
			// Not remembered when the browser blocks storage
		}
	},
}));
