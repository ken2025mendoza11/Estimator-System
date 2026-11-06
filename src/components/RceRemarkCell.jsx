import { remarkPlain } from "../lib/estimator/rceTemplate";

/**
 * @param {{ remarks?: unknown, files?: any[], readOnly?: boolean, onRemarks?: (text: string) => void, onFiles?: (files: any[]) => void, onOpen?: (index: number) => void }} props
 */
export function RceRemarkCell({ remarks, files = [], readOnly = false, onRemarks, onFiles, onOpen }) {
	return (
		<div className="rce-remark-cell">
			<textarea className="ce-input rce-area" rows={2} aria-label="Remarks" value={remarkPlain(remarks)} disabled={readOnly} onChange={(event) => onRemarks?.(event.target.value)} />
			<label className="rce-clip">
				Attach
				<input aria-label="Attach a file" type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,image/*" disabled={readOnly} onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (!file) return;
					onFiles?.([...(files || []), { name: file.name, type: file.type, pages: 1 }]);
				}} />
			</label>
			{(files || []).map((file, index) => (
				<button key={`${file?.name || "file"}-${index}`} type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => onOpen?.(index)}>
					{file?.name || "File"}
					{" "}
					<span aria-label={`Remove ${file?.name || "file"}`} onClick={(event) => {
						event.stopPropagation();
						if (!window.confirm("Remove this file?")) return;
						onFiles?.((files || []).filter((_, at) => at !== index));
					}}>×</span>
				</button>
			))}
		</div>
	);
}
