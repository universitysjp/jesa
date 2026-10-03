"use client";

import {
	BadgeCheck,
	Check,
	CircleAlert,
	FileText,
	GraduationCap,
	ShieldCheck,
	Upload,
	UserRound,
	X,
} from "lucide-react";
import { type ChangeEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SRI_LANKA_NIC_REGEX = /^[0-9]{9}[vVxX]$|^[0-9]{12}$/;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

type DocumentType = "portfolio" | "businessPlan" | "csrReport";

type FileSelection = {
	file: File;
	name: string;
	size: number;
};

type VerifiedApplication = {
	academic: {
		faculty?: string;
		university?: string;
		universityEmail?: string;
		universityRegistrationNumber?: string;
	};
	applicant: {
		email?: string;
		mobileNumber?: string;
		name?: string;
	};
	applicationReferenceNumber?: string;
	awards: Array<{
		code: string;
		label: string;
		registrationNumber?: string;
		status?: string;
	}>;
	submission: {
		hasSubmission: boolean;
		status: string;
	};
};

type VerificationResponse =
	| { application: VerifiedApplication; verificationToken: string }
	| { error: string };

type UploadUrlResponse =
	| { objectKey: string; uploadUrl: string }
	| { error: string };

type CompletionResponse = { error?: string; success?: boolean };

function hasAward(application: VerifiedApplication, awardCode: string) {
	return application.awards.some((award) => award.code === awardCode);
}

function isPdf(file: File) {
	return (
		file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
	);
}

function formatFileSize(bytes: number) {
	return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export default function PortfolioSubmissionClient() {
	const nicInputId = useId();
	const [nic, setNic] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isVerifying, setIsVerifying] = useState(false);
	const [application, setApplication] = useState<VerifiedApplication | null>(
		null,
	);
	const [verificationToken, setVerificationToken] = useState<string | null>(
		null,
	);

	async function verifyNic() {
		const normalizedNic = nic.trim().toUpperCase();

		if (!SRI_LANKA_NIC_REGEX.test(normalizedNic)) {
			setApplication(null);
			setVerificationToken(null);
			setError("Enter a valid NIC: 9 digits followed by V/X, or 12 digits.");
			return;
		}

		setNic(normalizedNic);
		setError(null);
		setIsVerifying(true);

		try {
			const response = await fetch("/api/portfolio-submission/verify", {
				body: JSON.stringify({ nic: normalizedNic }),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});
			const result: VerificationResponse = await response.json();

			if (!response.ok || !("application" in result)) {
				setApplication(null);
				setVerificationToken(null);
				setError(
					"error" in result
						? result.error
						: "We could not verify your application. Please try again.",
				);
				return;
			}

			setApplication(result.application);
			setVerificationToken(result.verificationToken);
		} catch {
			setApplication(null);
			setVerificationToken(null);
			setError("We could not verify your application. Please try again.");
		} finally {
			setIsVerifying(false);
		}
	}

	return (
		<section className="relative overflow-hidden px-safe pt-28 pb-20 sm:pt-32 md:pt-36 md:pb-28">
			<div
				aria-hidden="true"
				className="absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(closest-side_at_50%_10%,rgba(251,191,36,0.13),transparent)]"
			/>

			<div className="container relative mx-auto max-w-6xl px-4 sm:px-6">
				<div className="mx-auto max-w-2xl text-center">
					<div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-amber-300 text-sm">
						<ShieldCheck aria-hidden="true" className="size-4" />
						Application verification
					</div>
					<h1 className="font-title text-4xl text-white leading-tight tracking-tight sm:text-5xl lg:text-6xl">
						Portfolio <span className="text-amber-300">submission</span>
					</h1>
					<p className="mx-auto mt-5 max-w-xl text-slate-300 leading-7 sm:text-lg">
						Verify your application to review your registration and document
						requirements.
					</p>
				</div>

				<div className="mx-auto mt-10 max-w-xl rounded-2xl border border-amber-400/20 bg-slate-900/80 p-5 shadow-2xl shadow-black/25 backdrop-blur sm:p-7">
					<div className="flex gap-4">
						<div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-400 font-semibold text-primary-foreground">
							1
						</div>
						<div>
							<h2 className="font-semibold text-xl">Verify your NIC</h2>
							<p className="mt-1 text-slate-400 text-sm leading-6">
								We use this only to find your JESA application.
							</p>
						</div>
					</div>

					<div className="mt-6">
						<label className="font-medium text-sm" htmlFor={nicInputId}>
							National Identity Card number
						</label>
						<div className="mt-2 flex flex-col gap-3 sm:flex-row">
							<Input
								aria-describedby={error ? `${nicInputId}-error` : undefined}
								aria-invalid={Boolean(error)}
								className="h-11 bg-background uppercase placeholder:text-slate-500"
								disabled={isVerifying}
								id={nicInputId}
								maxLength={12}
								onChange={(event) => setNic(event.target.value)}
								placeholder="e.g. 991690883V"
								value={nic}
							/>
							<Button
								className="h-11 shrink-0 px-6"
								disabled={isVerifying}
								onClick={verifyNic}
								type="button"
							>
								{isVerifying ? "Verifying..." : "Verify NIC"}
							</Button>
						</div>
						{error ? (
							<p
								className="mt-2 flex items-center gap-2 text-destructive text-sm"
								id={`${nicInputId}-error`}
								role="alert"
							>
								<CircleAlert aria-hidden="true" className="size-4" />
								{error}
							</p>
						) : null}
					</div>
				</div>

				{application && verificationToken ? (
					<StudentDashboard
						application={application}
						onApplicationChange={setApplication}
						verificationToken={verificationToken}
					/>
				) : null}
			</div>
		</section>
	);
}

function StudentDashboard({
	application,
	onApplicationChange,
	verificationToken,
}: {
	application: VerifiedApplication;
	onApplicationChange: (application: VerifiedApplication) => void;
	verificationToken: string;
}) {
	const requiresBusinessPlan = hasAward(application, "best-young-entrepreneur");
	const requiresCsrReport = hasAward(application, "best-csr");
	const requiredDocuments: DocumentType[] = [
		"portfolio",
		...(requiresBusinessPlan ? (["businessPlan"] as const) : []),
		...(requiresCsrReport ? (["csrReport"] as const) : []),
	];
	const [files, setFiles] = useState<
		Partial<Record<DocumentType, FileSelection>>
	>({});
	const [fileErrors, setFileErrors] = useState<
		Partial<Record<DocumentType, string>>
	>({});
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const hasAllRequiredFiles = requiredDocuments.every(
		(documentType) => files[documentType],
	);
	const hasSubmitted = application.submission.hasSubmission;

	function handleFileChange(
		documentType: DocumentType,
		event: ChangeEvent<HTMLInputElement>,
	) {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;

		if (!isPdf(file)) {
			setFileErrors((current) => ({
				...current,
				[documentType]: "Choose a PDF file.",
			}));
			return;
		}
		if (file.size > MAX_FILE_SIZE_BYTES) {
			setFileErrors((current) => ({
				...current,
				[documentType]: "The PDF must be 20 MB or smaller.",
			}));
			return;
		}

		setFiles((current) => ({
			...current,
			[documentType]: { file, name: file.name, size: file.size },
		}));
		setFileErrors((current) => ({ ...current, [documentType]: undefined }));
	}

	async function submitDocuments() {
		if (!hasAllRequiredFiles || isSubmitting) return;
		setIsSubmitting(true);
		setUploadError(null);

		try {
			for (const documentType of requiredDocuments) {
				const selection = files[documentType];
				if (!selection) throw new Error("Choose all required documents first.");

				const uploadUrlResponse = await fetch(
					"/api/portfolio-submission/upload-url",
					{
						body: JSON.stringify({
							contentType: "application/pdf",
							documentType,
							fileName: selection.name,
							sizeBytes: selection.size,
							verificationToken,
						}),
						headers: { "Content-Type": "application/json" },
						method: "POST",
					},
				);
				const uploadUrlResult: UploadUrlResponse =
					await uploadUrlResponse.json();
				if (!uploadUrlResponse.ok || !("uploadUrl" in uploadUrlResult)) {
					throw new Error(
						"error" in uploadUrlResult
							? uploadUrlResult.error
							: "Could not prepare your upload.",
					);
				}

				let uploadResponse: Response;
				try {
					uploadResponse = await fetch(uploadUrlResult.uploadUrl, {
						body: selection.file,
						headers: { "Content-Type": "application/pdf" },
						method: "PUT",
					});
				} catch {
					throw new Error(
						"Your browser could not reach Tigris Storage. Check the bucket CORS origins, PUT method, and allowed headers.",
					);
				}
				if (!uploadResponse.ok) {
					const responseBody = await uploadResponse.text();
					const storageCode = responseBody.match(/<Code>([^<]+)<\/Code>/)?.[1];
					throw new Error(
						`Tigris upload failed (HTTP ${uploadResponse.status}${storageCode ? `: ${storageCode}` : ""}).`,
					);
				}

				const completionResponse = await fetch(
					"/api/portfolio-submission/complete",
					{
						body: JSON.stringify({
							documentType,
							objectKey: uploadUrlResult.objectKey,
							originalFileName: selection.name,
							verificationToken,
						}),
						headers: { "Content-Type": "application/json" },
						method: "POST",
					},
				);
				const completionResult: CompletionResponse =
					await completionResponse.json();
				if (!completionResponse.ok || !completionResult.success) {
					throw new Error(
						completionResult.error ?? "Could not confirm your upload.",
					);
				}
			}

			setFiles({});
			onApplicationChange({
				...application,
				submission: { hasSubmission: true, status: "submitted" },
			});
		} catch (submissionError) {
			setUploadError(
				submissionError instanceof Error
					? submissionError.message
					: "Could not submit your documents. Please try again.",
			);
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<div className="mt-8 space-y-6" id="submission-dashboard">
			<div className="grid gap-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
				<aside className="rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 sm:p-6">
					<div className="flex items-center gap-3">
						<div className="flex size-11 items-center justify-center rounded-full bg-secondary text-amber-300">
							<UserRound aria-hidden="true" className="size-5" />
						</div>
						<div>
							<p className="font-semibold">
								{application.applicant.name ?? "Applicant"}
							</p>
							<p className="text-slate-400 text-sm">
								{application.applicationReferenceNumber ??
									"Verified application"}
							</p>
						</div>
					</div>

					<div className="mt-6 space-y-4 border-slate-700/70 border-t pt-5 text-sm">
						<DashboardField
							icon={UserRound}
							label="Email"
							value={application.applicant.email}
						/>
						<DashboardField
							icon={UserRound}
							label="Mobile"
							value={application.applicant.mobileNumber}
						/>
						<DashboardField
							icon={GraduationCap}
							label="University"
							value={application.academic.university}
						/>
						<DashboardField
							icon={GraduationCap}
							label="Faculty"
							value={application.academic.faculty}
						/>
						<DashboardField
							icon={GraduationCap}
							label="Registration number"
							value={application.academic.universityRegistrationNumber}
						/>
					</div>
				</aside>

				<div className="rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 sm:p-6">
					<div className="flex items-center gap-3">
						<div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-400 font-semibold text-primary-foreground">
							2
						</div>
						<div>
							<p className="text-amber-300 text-sm font-medium">
								Verified details
							</p>
							<h2 className="font-semibold text-2xl">Award documents</h2>
						</div>
					</div>

					{!hasSubmitted ? (
						<div className="mt-5 space-y-3">
							<DocumentUploadCard
								description="Required for every applicant."
								documentType="portfolio"
								error={fileErrors.portfolio}
								file={files.portfolio}
								label="Portfolio"
								onChange={handleFileChange}
								onRemove={() =>
									setFiles((current) => ({ ...current, portfolio: undefined }))
								}
							/>
							{requiresBusinessPlan ? (
								<DocumentUploadCard
									description="Required for your Best Young Entrepreneur application."
									documentType="businessPlan"
									error={fileErrors.businessPlan}
									file={files.businessPlan}
									label="Business Plan"
									onChange={handleFileChange}
									onRemove={() =>
										setFiles((current) => ({
											...current,
											businessPlan: undefined,
										}))
									}
								/>
							) : null}
							{requiresCsrReport ? (
								<DocumentUploadCard
									description="Required for your Best CSR application."
									documentType="csrReport"
									error={fileErrors.csrReport}
									file={files.csrReport}
									label="CSR Report"
									onChange={handleFileChange}
									onRemove={() =>
										setFiles((current) => ({
											...current,
											csrReport: undefined,
										}))
									}
								/>
							) : null}
						</div>
					) : null}

					<div className="mt-6 flex flex-col gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p className="font-medium">Submission status</p>
							{hasSubmitted ? (
								<p className="mt-1 font-medium text-emerald-400 text-sm">
									Current status:{" "}
									{application.submission.status.replaceAll("_", " ")}
								</p>
							) : (
								<p className="mt-1 text-slate-400 text-sm">
									No documents have been submitted.
								</p>
							)}
						</div>
						{!hasSubmitted ? (
							<Button
								disabled={!hasAllRequiredFiles || isSubmitting}
								onClick={submitDocuments}
								type="button"
							>
								{isSubmitting ? "Submitting..." : "Submit documents"}
							</Button>
						) : null}
					</div>
					{uploadError ? (
						<p
							className="mt-3 flex items-center gap-2 text-destructive text-sm"
							role="alert"
						>
							<CircleAlert aria-hidden="true" className="size-4" />
							{uploadError}
						</p>
					) : null}

					<div className="mt-6 border-slate-700/70 border-t pt-5">
						<h3 className="font-medium">Registered awards</h3>
						<ul className="mt-3 space-y-2">
							{application.awards.map((award) => (
								<li
									className="flex items-center gap-3 rounded-lg bg-background/50 px-3 py-2 text-sm"
									key={award.code}
								>
									<BadgeCheck
										aria-hidden="true"
										className="size-4 shrink-0 text-amber-300"
									/>
									<span className="min-w-0 flex-1">{award.label}</span>
									{award.registrationNumber ? (
										<span className="text-slate-400">
											{award.registrationNumber}
										</span>
									) : null}
								</li>
							))}
						</ul>
					</div>
				</div>
			</div>
		</div>
	);
}

function DashboardField({
	icon: Icon,
	label,
	value,
}: {
	icon: typeof UserRound;
	label: string;
	value?: string;
}) {
	if (!value) return null;

	return (
		<div className="flex gap-3">
			<Icon
				aria-hidden="true"
				className="mt-0.5 size-4 shrink-0 text-amber-300"
			/>
			<div>
				<p className="text-slate-400">{label}</p>
				<p className="mt-0.5 text-slate-200">{value}</p>
			</div>
		</div>
	);
}

function DocumentUploadCard({
	description,
	documentType,
	error,
	file,
	label,
	onChange,
	onRemove,
}: {
	description: string;
	documentType: DocumentType;
	error?: string;
	file?: FileSelection;
	label: string;
	onChange: (
		documentType: DocumentType,
		event: ChangeEvent<HTMLInputElement>,
	) => void;
	onRemove: () => void;
}) {
	const inputId = useId();
	const messageId = `${inputId}-message`;

	return (
		<div className="flex flex-col gap-4 rounded-xl border border-slate-700/80 bg-background/50 p-4 sm:flex-row sm:items-start">
			<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-amber-300">
				<FileText aria-hidden="true" className="size-4" />
			</div>
			<div className="min-w-0 flex-1 self-stretch">
				<div className="flex flex-wrap items-center gap-2">
					<h3 className="font-medium">{label}</h3>
					<span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-amber-200 text-xs">
						Required
					</span>
				</div>
				<p className="mt-1 text-slate-400 text-sm">{description}</p>
				{file ? (
					<p
						className="mt-2 flex items-center gap-2 text-emerald-500 text-sm"
						id={messageId}
					>
						<Check aria-hidden="true" className="size-4" />
						<span className="truncate">{file.name}</span> ·{" "}
						{formatFileSize(file.size)}
					</p>
				) : (
					<p className="mt-2 text-slate-300 text-xs">PDF · 20 MB maximum</p>
				)}
				{error ? (
					<p
						className="mt-2 flex items-center gap-2 text-destructive text-sm"
						id={messageId}
						role="alert"
					>
						<CircleAlert aria-hidden="true" className="size-4" />
						{error}
					</p>
				) : null}
			</div>
			{file ? (
				<Button
					aria-label={`Remove ${label} file`}
					onClick={onRemove}
					size="icon"
					type="button"
					variant="ghost"
				>
					<X aria-hidden="true" />
				</Button>
			) : (
				<label className="inline-flex h-9 w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-input/30 px-3 font-medium text-sm transition-colors hover:bg-input/50 focus-within:ring-[3px] focus-within:ring-ring/50 sm:w-auto">
					<Upload aria-hidden="true" className="size-4" />
					Choose PDF
					<input
						accept="application/pdf,.pdf"
						aria-describedby={error ? messageId : undefined}
						className="sr-only"
						id={inputId}
						onChange={(event) => onChange(documentType, event)}
						type="file"
					/>
				</label>
			)}
		</div>
	);
}
