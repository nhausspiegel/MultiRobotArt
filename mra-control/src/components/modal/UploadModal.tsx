/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {Modal} from 'flowbite-react';
import React, {useCallback, useState} from 'react';
import {useDropzone} from 'react-dropzone';

import {CancelButton} from '../buttons/CancelButton';

export const UploadFileModal = ({
	open,
	onClose,
	onFileUpload,
	header,
}: {
	open: boolean;
	onClose: () => void;
	onFileUpload: (file: string) => void;
	header: string;
}) => {
	const [error, setError] = useState<string>();
	const close = () => {
		setError(undefined);
		onClose();
	};

	const onDrop = useCallback((acceptedFiles: File[]) => {
		setError(undefined);
		acceptedFiles.forEach((file: File) => {
			const reader = new FileReader();

			reader.onabort = () => {
				setError('Reading the file was cancelled.');
			};

			reader.onerror = () => {
				setError('The file could not be read.');
			};

			reader.onload = () => {
				try {
					onFileUpload(reader.result as string);
					onClose();
				} catch (e) {
					setError(e instanceof SyntaxError ? 'This file is not a Robart project (it could not be parsed).' : (e as Error).message);
				}
			};

			// As text: readAsBinaryString garbled any non-ASCII characters (é, ü, ×) in names
			reader.readAsText(file);
		});
	}, []);

	const {getRootProps, getInputProps, inputRef} = useDropzone({
		onDrop: (a) => {
			onDrop(a); 
		},
		multiple: false,
		onDragEnter: (_e: any) => {},
		onDragLeave: (_e: any) => {},
		onDragOver: (_e: any) => {},
		accept: {
			'application/json': ['.robart'],
		},
	});

	return (
		<Modal show={open} onClose={close}>
			<Modal.Header>{header}</Modal.Header>
			<Modal.Body>
				<div className="border-1 flex justify-center border-gray-500 bg-gray-50 p-5 py-14 text-lg shadow-lg" {...getRootProps()}>
					<input ref={inputRef} {...getInputProps()} />
					<p>Drag & drop a project file here, or click to select a file</p>
				</div>
				{error && <p className="mt-3 text-red-600">{error}</p>}
			</Modal.Body>
			<Modal.Footer>
				<CancelButton onClick={close} />
			</Modal.Footer>
		</Modal>
	);
};
