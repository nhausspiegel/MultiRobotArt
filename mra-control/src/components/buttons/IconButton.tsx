import {type faGear} from '@fortawesome/free-solid-svg-icons';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {Button} from 'flowbite-react';
import {type ReactEventHandler} from 'react';
import * as React from 'react';

export const IconButton = ({
	icon,
	text,
	color,
	onClick,
	className,
	type,
	disabled,
}: {
	icon: typeof faGear;
	text: string;
	color?: 'gray' | 'warning' | 'success' | 'failure';
	className?: string;
	onClick?: ReactEventHandler;
	type?: 'button' | 'submit' | 'reset';
	disabled?: boolean;
}) => {
	return (
		<Button className={className} onClick={onClick} color={color} type={type} disabled={disabled}>
			<FontAwesomeIcon icon={icon} />
			{text !== '' ? <span className="ml-2">{text}</span> : null}
		</Button>
	);
};
