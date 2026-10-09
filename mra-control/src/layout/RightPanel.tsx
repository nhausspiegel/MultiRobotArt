import {BlockPythonCodePanel} from './BlockPythonCodePanel';
import {SimulationPanel} from './simulation/SimulationPanel';
import {Button} from 'flowbite-react';
import {BlockJavaScriptCodePanel} from './BlockJavaScriptCodePanel';
import {useState} from 'react';
import {useWarningCount, WarningsPanel} from './WarningsPanel';
import React from 'react';

type TabName = 'simulation' | 'python' | 'javascript' | 'warnings';
export const RightPanel = () => {
	const [selectedTab, setSelectedTab] = useState<TabName>('simulation');
	const warnings = useWarningCount();
	return  <>
		<div className='flex flex-col gap-2 h-full'>
			<div>
				<Button.Group>
					<Button color={selectedTab == 'simulation' ? 'blue' : 'gray'} onClick={() => {
						setSelectedTab('simulation'); 
					}}>
          Simulation
					</Button>
					<Button color={selectedTab == 'python' ? 'blue' : 'gray'} onClick={() => {
						setSelectedTab('python'); 
					}}>
          Python Code
					</Button>
					<Button color={selectedTab == 'javascript' ? 'blue' : 'gray'} onClick={() => {
						setSelectedTab('javascript'); 
					}}>
          JavaScript Code
					</Button>
					<Button color={selectedTab == 'warnings' ? 'blue' : 'gray'} onClick={() => {
						setSelectedTab('warnings'); 
					}}>
          Warnings{warnings > 0 ? ` (${warnings})` : ''}
					</Button>
				</Button.Group>
			</div>
			{/* min-h-0, not h-full: h-full made this 100% tall plus the tab bar, so the bottom was cut off and code tabs couldn't scroll */}
			<div className='min-h-0 flex-grow'>
				{selectedTab == 'simulation' && <SimulationPanel />}
				{selectedTab == 'python' && <BlockPythonCodePanel />}
				{selectedTab == 'javascript' && <BlockJavaScriptCodePanel />}
				{selectedTab == 'warnings' && <WarningsPanel />}
			</div>
		</div>
	</>;
};
