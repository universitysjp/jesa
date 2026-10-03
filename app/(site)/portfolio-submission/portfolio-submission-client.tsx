"use client";

import {
	BadgeCheck,
	CircleAlert,
	FileText,
	GraduationCap,
	ShieldCheck,
	UserRound,
} from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SRI_LANKA_NIC_REGEX = /^[0-9]{9}[vVxX]$|^[0-9]{12}$/;

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
	| { application: VerifiedApplication }
	| { error: string };

function hasAward(application: VerifiedApplication, awardCode: string) {
	return application.awards.some((award) => award.code === awardCode);
}

export default function PortfolioSubmissionClient() {
	const nicInputId = useId();
	const [nic, setNic] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isVerifying, setIsVerifying] = useState(false);
	const [application, setApplication] = useState<VerifiedApplication | null>(
		null,
	);

	async function verifyNic() {
		const normalizedNic = nic.trim().toUpperCase();

		if (!SRI_LANKA_NIC_REGEX.test(normalizedNic)) {
			setApplication(null);
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
				setError(
					"error" in result
						? result.error
						: "We could not verify your application. Please try again.",
				);
				return;
			}

			setApplication(result.application);
		} catch {
			setApplication(null);
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

				{application ? <StudentDashboard application={application} /> : null}
			</div>
		</section>
	);
}

function StudentDashboard({
	application,
}: {
	application: VerifiedApplication;
}) {
	const requiresBusinessPlan = hasAward(application, "best-young-entrepreneur");
	const requiresCsrReport = hasAward(application, "best-csr");
	const actionLabel = application.submission.hasSubmission
		? "Resubmit documents"
		: "Submit documents";

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

					<div className="mt-5 space-y-3">
						<DocumentRequirement
							description="Required for every applicant."
							label="Portfolio"
							required
						/>
						{requiresBusinessPlan ? (
							<DocumentRequirement
								description="Required for your Best Young Entrepreneur application."
								label="Business Plan"
								required
							/>
						) : null}
						{requiresCsrReport ? (
							<DocumentRequirement
								description="Required for your Best CSR application."
								label="CSR Report"
								required
							/>
						) : null}
					</div>

					<div className="mt-6 flex flex-col gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p className="font-medium">Submission status</p>
							<p className="mt-1 text-slate-400 text-sm">
								{application.submission.hasSubmission
									? `Current status: ${application.submission.status.replaceAll("_", " ")}`
									: "No documents have been submitted."}
							</p>
						</div>
						<Button disabled type="button">
							{actionLabel}
						</Button>
					</div>

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

function DocumentRequirement({
	description,
	label,
	required,
}: {
	description: string;
	label: string;
	required: boolean;
}) {
	return (
		<div className="flex gap-3 rounded-xl border border-slate-700/80 bg-background/50 p-4">
			<div className="mt-0.5 rounded-full bg-secondary p-2 text-amber-300">
				<FileText aria-hidden="true" className="size-4" />
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-2">
					<h3 className="font-medium">{label}</h3>
					{required ? (
						<span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-amber-200 text-xs">
							Required
						</span>
					) : null}
				</div>
				<p className="mt-1 text-slate-400 text-sm">{description}</p>
				<p className="mt-2 text-slate-300 text-xs">PDF · 20 MB maximum</p>
			</div>
		</div>
	);
}
