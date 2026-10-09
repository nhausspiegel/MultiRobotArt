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
};

export type UIActions = {
	toggleSettingsModal: () => void;
	toggleCurveEditor: () => void;
	setEditingRobotId: (robotId: string | undefined) => void;
	toggleSimulation: () => void;
};

export type UIStoreState = UIState & UIActions;

/**
 * Store for non-persistent UI state.
 */
export const useUIState = create<UIStoreState>()((set, get) => ({
	settingsModalOpen: false,
	curveEditorOpen: false,
	openSimulation: false,
	editingRobotId: undefined,
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
}));
