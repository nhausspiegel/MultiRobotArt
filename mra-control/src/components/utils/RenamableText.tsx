import clsx from 'clsx';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import React from 'react';
type RenamableTextProps = {
	text: string;
	className?: string;
	updateText: (updatedText: string) => void;
	// Plain text, for a name inside something else (a block in the block list); otherwise a heading with a hover outline
	bare?: boolean;
	// Told when the name starts and stops being typed (however it stops: Enter, Escape, clicking away, or this going away)
	onEditingChange?: (editing: boolean) => void;
};

export const RenamableText = ({text, updateText, className, bare, onEditingChange}: RenamableTextProps) => {
	const [showRenameInput, setShowRenameInput] = useState(false);
	const [inputValue, setInputValue] = useState('');
	const [width, setWidth] = useState(0);
	const span = useRef<HTMLSpanElement>(null);
	// Set once Enter or Escape has handled the edit, so the blur that follows doesn't apply it again
	const finished = useRef(false);

	// From this state, not focus events: Enter and Escape remove the box while it has focus, and browsers don't report
	// focus leaving a removed element
	const editingChange = useRef(onEditingChange);
	editingChange.current = onEditingChange;
	useEffect(() => {
		if (!showRenameInput) return;
		editingChange.current?.(true);
		return () => editingChange.current?.(false);
	}, [showRenameInput]);

	// Before the box is drawn: measured after (useEffect), the first edit showed it 0 wide for a frame
	useLayoutEffect(() => {
		if (span.current === null) return;

		setWidth(span.current?.offsetWidth);
	}, [inputValue]);

	const defaultClassName = bare ? 'cursor-text rounded px-1' : 'h-min w-fit rounded-md border-2 border-white hover:border-black';

	return !showRenameInput ? (
		<h2
			className={clsx(defaultClassName, className)}
			onClick={() => {
				finished.current = false;
				setInputValue(text);
				setShowRenameInput(true);
			}}
		>
			{text}
		</h2>
	) : (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				finished.current = true;
				updateText(inputValue);
				setShowRenameInput(false);
			}}
		>
			<span className={clsx(defaultClassName, className, 'absolute -z-40 whitespace-pre')} ref={span}>
				{inputValue}
			</span>
			<input
				className={clsx(defaultClassName, className, bare && 'bg-white outline-none ring-1 ring-black/30')}
				value={inputValue}
				style={{width: `calc(${width}px + 1ch)`}}
				onChange={(e) => {
					setInputValue(e.target.value); 
				}}
				// Clicking away saves too (it used to discard the edit, e.g. when clicking Done in a window); Escape cancels
				onBlur={() => {
					if (!finished.current) updateText(inputValue);
					finished.current = true;
					setShowRenameInput(false);
				}}
				onKeyDown={(e) => {
					if (e.key !== 'Escape') return;
					finished.current = true;
					setShowRenameInput(false);
				}}
				autoFocus
			/>
			<input type="submit" className="hidden" />
		</form>
	);
};
