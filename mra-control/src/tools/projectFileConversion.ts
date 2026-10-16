import {type MRAState, type ProjectFile} from '../state/useRobartState';
import {saveToFile} from './saveToFile';
import {exportToROS} from './exportToROS';

export const saveProjectToFile = (projectState: MRAState, fileName: string | undefined = undefined) => {
	const projectStateJson = JSON.stringify(projectState);
	fileName = fileName ?? projectState.projectName.replaceAll(' ', '') + '.robart';
	saveToFile(fileName, projectStateJson);
};

export const loadProjectFromFile = (fileContents: string): ProjectFile => {
	const projectState = JSON.parse(fileContents) as ProjectFile;
	// Loading something else would replace the project with a state the app can't render
	if (typeof projectState?.blocks !== 'object' || typeof projectState.robots !== 'object' || typeof projectState.timelineState?.groups !== 'object') {
		throw new Error('This file is not a Robart project.');
	}

	return projectState;
};

export const exportROS = (projectState: MRAState, fileName: string) => {
	exportToROS(projectState, fileName);
};