"use client";

import { CheckCircle2, FileJson, Loader2, Upload, XCircle } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { processBulkImport } from "./service/bulk-import-service";
import {
	type BulkImportResult,
	resolveAwardCodeFromFaculty,
	validateBulkImportJson,
} from "./service/bulk-import-types";

type BulkImportDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

type Step = "upload" | "preview" | "processing" | "done";

type ParsedItem = {
	applicationId: string;
	name: string;
	email: string;
	faculty: string;
	awardCode: string;
};

const AWARD_LABELS: Record<string, string> = {
	"best-leader": "Best Leader",
	"best-team-player": "Best Team Player",
	"best-creative-designer": "Best Creative Designer",
	"best-communicator": "Best Communicator",
	"best-innovator": "Best Innovator",
	"best-young-entrepreneur": "Best Young Entrepreneur",
	"best-csr": "Best CSR",
	"besa-inter-university": "BESA Inter University",
	"besa-fhss": "BESA FHSS",
	"besa-fas": "BESA FAS",
	"besa-fmsc": "BESA FMSC",
	"besa-fms": "BESA FMS",
	"besa-fot": "BESA FOT",
	"besa-foe": "BESA FOE",
	"besa-fahs": "BESA FAHS",
	"besa-fuab": "BESA FUAB",
	"besa-fds": "BESA FDS",
	"besa-foc": "BESA FOC",
};

export default function BulkImportDialog({
	open,
	onOpenChange,
}: BulkImportDialogProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [step, setStep] = useState<Step>("upload");
	const [error, setError] = useState("");
	const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
	const [rawItems, setRawItems] = useState<unknown[]>([]);
	const [sendEmails, setSendEmails] = useState(true);
	const [result, setResult] = useState<BulkImportResult | null>(null);
	const [processingIndex, setProcessingIndex] = useState(0);

	const reset = useCallback(() => {
		setStep("upload");
		setError("");
		setParsedItems([]);
		setRawItems([]);
		setResult(null);
		setProcessingIndex(0);
	}, []);

	function handleClose() {
		reset();
		onOpenChange(false);
	}

	function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setError("");

		const reader = new FileReader();
		reader.onload = (event) => {
			try {
				const data = JSON.parse(event.target?.result as string);
				const validation = validateBulkImportJson(data);
				if (!validation.valid) {
					setError(validation.error || "Invalid JSON format.");
					return;
				}

				const items: ParsedItem[] = validation.items.map((item) => {
					const faculty = item.academicInfo?.faculty?.toUpperCase() || "";
					const awardKeys = item.awardSelection?.selectedAwards || [];
					let awardCode = awardKeys[0] || "";
					if (!awardCode && faculty) {
						awardCode = resolveAwardCodeFromFaculty(faculty) || "";
					}
					return {
						applicationId: item.applicationId,
						name: item.personalInfo.publicDisplayName,
						email: item.personalInfo.email,
						faculty,
						awardCode,
					};
				});

				setParsedItems(items);
				setRawItems(validation.items);
				setStep("preview");
			} catch {
				setError("Failed to parse JSON file. Please check the format.");
			}
		};
		reader.readAsText(file);
		e.target.value = "";
	}

	async function handleImport() {
		setStep("processing");
		setProcessingIndex(0);

		const total = rawItems.length;
		for (let i = 0; i < total; i++) {
			setProcessingIndex(i + 1);
		}

		try {
			const importResult = await processBulkImport(
				rawItems as Parameters<typeof processBulkImport>[0],
				{ sendEmails },
			);
			setResult(importResult);
			setStep("done");
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Import failed unexpectedly.",
			);
			setStep("preview");
		}
	}

	const created =
		result?.results.filter((r) => r.status === "created").length || 0;
	const sent = result?.results.filter((r) => r.status === "sent").length || 0;
	const failed =
		result?.results.filter(
			(r) => r.status === "failed" || r.status === "send_failed",
		).length || 0;

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
				<DialogHeader className="border-border border-b bg-muted/30 px-6 py-4">
					<DialogTitle className="flex items-center gap-2 text-base">
						<FileJson className="size-4 text-amber-400" />
						Bulk Import JSON
					</DialogTitle>
				</DialogHeader>

				{/* Step: Upload */}
				{step === "upload" && (
					<div className="px-6 py-8">
						<button
							className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-border/60 bg-muted/10 py-10 transition-colors hover:border-amber-500/30 hover:bg-amber-500/5"
							onClick={() => fileInputRef.current?.click()}
							type="button"
						>
							<Upload className="size-8 text-muted-foreground/50" />
							<span className="text-center">
								<span className="block font-medium text-foreground text-sm">
									Click to upload JSON file
								</span>
								<span className="mt-1 block text-muted-foreground text-xs">
									Accepted format: .json
								</span>
							</span>
						</button>
						<input
							accept=".json"
							className="hidden"
							onChange={handleFileSelect}
							ref={fileInputRef}
							type="file"
						/>
						{error && (
							<p className="mt-3 text-center text-red-400 text-xs">{error}</p>
						)}
					</div>
				)}

				{/* Step: Preview */}
				{step === "preview" && (
					<div className="flex flex-col">
						<div className="flex items-center justify-between border-border border-b px-6 py-3">
							<p className="text-foreground text-sm font-medium">
								{parsedItems.length} application
								{parsedItems.length !== 1 ? "s" : ""} ready to import
							</p>
							<label className="flex items-center gap-2 text-xs">
								<input
									checked={sendEmails}
									className="size-3.5 accent-amber-400"
									onChange={(e) => setSendEmails(e.target.checked)}
									type="checkbox"
								/>
								<span className="text-muted-foreground">Send emails</span>
							</label>
						</div>
						<div className="max-h-72 overflow-y-auto px-6 py-2">
							<table className="w-full text-xs">
								<thead>
									<tr className="text-muted-foreground">
										<th className="px-2 py-2 text-left font-medium">Name</th>
										<th className="px-2 py-2 text-left font-medium">Email</th>
										<th className="px-2 py-2 text-left font-medium">Faculty</th>
										<th className="px-2 py-2 text-left font-medium">Award</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border/50">
									{parsedItems.map((item, i) => (
										<tr key={item.applicationId || i}>
											<td className="px-2 py-2 text-foreground">{item.name}</td>
											<td className="px-2 py-2 text-muted-foreground">
												{item.email}
											</td>
											<td className="px-2 py-2 text-muted-foreground">
												{item.faculty || "-"}
											</td>
											<td className="px-2 py-2">
												{item.awardCode ? (
													<span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-400">
														{AWARD_LABELS[item.awardCode] || item.awardCode}
													</span>
												) : (
													<span className="text-red-400">No award</span>
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						{error && (
							<p className="px-6 py-2 text-center text-red-400 text-xs">
								{error}
							</p>
						)}
					</div>
				)}

				{/* Step: Processing */}
				{step === "processing" && (
					<div className="px-6 py-10 text-center">
						<Loader2 className="mx-auto size-8 animate-spin text-amber-400" />
						<p className="mt-4 font-medium text-foreground text-sm">
							Processing {rawItems.length} application
							{rawItems.length !== 1 ? "s" : ""}...
						</p>
						<p className="mt-1 text-muted-foreground text-xs">
							{processingIndex} of {rawItems.length} completed
						</p>
						<div className="mx-auto mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-muted">
							<div
								className="h-full rounded-full bg-amber-400 transition-all duration-300"
								style={{
									width: `${(processingIndex / rawItems.length) * 100}%`,
								}}
							/>
						</div>
					</div>
				)}

				{/* Step: Done */}
				{step === "done" && result && (
					<div className="px-6 py-5">
						<div className="mb-4 grid grid-cols-3 gap-3">
							<div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-center">
								<p className="font-semibold text-2xl text-emerald-400">
									{created + sent}
								</p>
								<p className="mt-0.5 text-emerald-300 text-xs">Created</p>
							</div>
							<div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-center">
								<p className="font-semibold text-2xl text-amber-400">{sent}</p>
								<p className="mt-0.5 text-amber-300 text-xs">Emails sent</p>
							</div>
							<div className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-center">
								<p className="font-semibold text-2xl text-red-400">{failed}</p>
								<p className="mt-0.5 text-red-300 text-xs">Failed</p>
							</div>
						</div>
						<div className="max-h-48 overflow-y-auto">
							<ul className="space-y-1.5">
								{result.results.map((item) => (
									<li
										className="flex items-center gap-2 rounded-lg bg-muted/20 px-3 py-2 text-xs"
										key={item.applicationId}
									>
										{item.status === "failed" ||
										item.status === "send_failed" ? (
											<XCircle className="size-3.5 shrink-0 text-red-400" />
										) : (
											<CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
										)}
										<div className="min-w-0 flex-1">
											<span className="font-medium text-foreground">
												{item.recipientName}
											</span>
											{item.registrationNumber && (
												<span className="ml-2 font-mono text-muted-foreground">
													{item.registrationNumber}
												</span>
											)}
										</div>
										<span className="shrink-0 text-muted-foreground">
											{item.message}
										</span>
									</li>
								))}
							</ul>
						</div>
					</div>
				)}

				{/* Footer */}
				<div className="flex items-center justify-end gap-2 border-border border-t bg-muted/30 px-6 py-3">
					{step === "preview" && (
						<>
							<Button onClick={reset} size="sm" type="button" variant="ghost">
								Upload different file
							</Button>
							<Button
								className="bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
								onClick={handleImport}
								size="sm"
								type="button"
								variant="outline"
							>
								Import {rawItems.length} application
								{rawItems.length !== 1 ? "s" : ""}
							</Button>
						</>
					)}
					{step === "done" && (
						<Button onClick={handleClose} size="sm" type="button">
							Close
						</Button>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
