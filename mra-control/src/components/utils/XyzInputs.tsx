import clsx from 'clsx';
import React, {useEffect, useState} from 'react';

export const isNumber = (value: string) => value.trim() !== '' && Number.isFinite(Number(value));
export const isPositiveNumber = (value: string) => value.trim() !== '' && Number(value) > 0;
// border: preflight zeroes input border widths, so a color alone draws nothing
export const fieldClass = (valid: boolean) => clsx('w-20 rounded px-2 py-1 disabled:opacity-50', valid ? 'border border-gray-300' : 'border-2 border-red-500');

type XyzInputsProps = {
	title: string;
	value: number[];
	isValid: (typed: string) => boolean;
	onSave: (value: [number, number, number]) => void;
};

// Boxes for x, y and z. They keep whatever is typed; onSave gets the numbers while all three are valid.
export const XyzInputs = ({title, value, isValid, onSave}: XyzInputsProps) => {
	const [values, setValues] = useState(value.map(String));
	// Follow changes made elsewhere (Reset Project, Load Project), but not the ones typed here
	useEffect(() => {
		if (!values.every((typed, i) => Number(typed) === value[i])) setValues(value.map(String));
	}, [value]);

	return (
		<div>
			<div className="mb-1 font-bold">{title}</div>
			<div className="flex gap-3">
				{['x', 'y', 'z'].map((axis, i) => (
					<label key={axis} className="flex items-center gap-1">
						{axis}
						<input
							className={fieldClass(isValid(values[i]))}
							inputMode="decimal"
							value={values[i]}
							onChange={(e) => {
								const next = values.map((typed, j) => (j === i ? e.target.value : typed));
								setValues(next);
								if (next.every(isValid)) onSave(next.map(Number) as [number, number, number]);
							}}
						/>
					</label>
				))}
			</div>
		</div>
	);
};
