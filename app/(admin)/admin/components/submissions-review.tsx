"use client";

import {
	Download,
	ExternalLink,
	FileText,
	Loader2,
	Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { getAwardLabel } from "@/lib/awards";

type DocumentType = "portfolio" | "businessPlan" | "csrReport";

type SubmissionFile = {
	objectPath?: string;
	originalFileName?: string;
	sizeBytes?: number;
	status?: string;
	uploadedAt?: string | null;
};

type SubmissionReview = {
	academic: {
		academicYear?: string;
		degree?: string;
		faculty?: string;
		university?: string;
		universityEmail?: string;
		universityRegistrationNumber?: string;
	};
	applicant: {
		email?: string;
		mobileNumber?: string;
		name?: string;
		nic?: string;
	};
	applicationId: string;
	applicationReferenceNumber?: string;
	awardRegistrations: Array<{
		awardCode?: string;
		awardLabel?: string;
		registrationNumber?: string;
		status?: string;
	}>;
	documents: Record<DocumentType, SubmissionFile | null>;
	requiredDocuments: DocumentType[];
	selectedAwards: string[];
	submissionStatus: string;
	updatedAt?: string | null;
};

type SortOption = "updated-desc" | "name-asc" | "name-desc" | "status";

const DOCUMENT_LABELS: Record<DocumentType, string> = {
	businessPlan: "Business Plan",
	csrReport: "CSR Report",
	portfolio: "Portfolio",
};

function formatDate(value?: string | null) {
	return value ? new Date(value).toLocaleString() : "—";
}

function formatFileSize(bytes?: number) {
	if (!bytes) return "—";
	return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function documentState(
	submission: SubmissionReview,
	documentType: DocumentType,
) {
	if (!submission.requiredDocuments.includes(documentType))
		return "not-required";
	return submission.documents[documentType]?.status === "uploaded"
		? "uploaded"
		: "missing";
}

function uploadedDocumentCount(submission: SubmissionReview) {
	return (["portfolio", "businessPlan", "csrReport"] as DocumentType[]).filter(
		(documentType) => Boolean(submission.documents[documentType]?.objectPath),
	).length;
}

function statusBadge(status: string) {
	const isSubmitted = status === "submitted";
	return `inline-flex rounded-full border px-2 py-0.5 text-xs ${
		isSubmitted
			? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
			: "border-amber-400/30 bg-amber-400/10 text-amber-200"
	}`;
}

export default function SubmissionsReview() {
	const [submissions, setSubmissions] = useState<SubmissionReview[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState("all");
	const [faculty, setFaculty] = useState("all");
	const [documentFilter, setDocumentFilter] = useState("all");
	const [sort, setSort] = useState<SortOption>("updated-desc");
	const [selected, setSelected] = useState<SubmissionReview | null>(null);

	const fetchSubmissions = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const response = await fetch("/api/admin/submissions");
			if (!response.ok) throw new Error("Failed to fetch submissions");
			const data = await response.json();
			setSubmissions(data.submissions ?? []);
		} catch (fetchError) {
			setError(
				fetchError instanceof Error ? fetchError.message : "Unknown error",
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchSubmissions();
	}, [fetchSubmissions]);

	const faculties = useMemo(
		() =>
			Array.from(
				new Set(
					submissions.map((item) => item.academic.faculty).filter(Boolean),
				),
			).sort() as string[],
		[submissions],
	);

	const filteredSubmissions = useMemo(() => {
		const term = search.trim().toLowerCase();
		return submissions
			.filter((submission) => {
				const searchable = [
					submission.applicant.name,
					submission.applicant.email,
					submission.applicant.nic,
					submission.applicant.mobileNumber,
					submission.academic.universityRegistrationNumber,
					submission.applicationReferenceNumber,
				]
					.filter(Boolean)
					.join(" ")
					.toLowerCase();
				const matchesSearch = !term || searchable.includes(term);
				const matchesStatus =
					status === "all" || submission.submissionStatus === status;
				const matchesFaculty =
					faculty === "all" || submission.academic.faculty === faculty;
				const matchesDocument =
					documentFilter === "all" ||
					documentState(submission, documentFilter as DocumentType) ===
						"uploaded";

				return (
					matchesSearch && matchesStatus && matchesFaculty && matchesDocument
				);
			})
			.sort((a, b) => {
				if (sort === "name-asc")
					return (a.applicant.name ?? "").localeCompare(b.applicant.name ?? "");
				if (sort === "name-desc")
					return (b.applicant.name ?? "").localeCompare(a.applicant.name ?? "");
				if (sort === "status")
					return a.submissionStatus.localeCompare(b.submissionStatus);
				return (
					new Date(b.updatedAt ?? 0).getTime() -
					new Date(a.updatedAt ?? 0).getTime()
				);
			});
	}, [documentFilter, faculty, search, sort, status, submissions]);

	return (
		<section className="space-y-6">
			<div className="grid gap-4 rounded-2xl border border-slate-700/50 bg-slate-900/50 p-4 md:grid-cols-5">
				<div className="relative md:col-span-2">
					<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
					<Input
						className="rounded-[8px] pl-9"
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Search name, NIC, mobile, reg no..."
						value={search}
					/>
				</div>
				<FilterSelect
					label="All Statuses"
					onChange={setStatus}
					value={status}
					values={["submitted", "incomplete"]}
				/>
				<FilterSelect
					label="All Faculties"
					onChange={setFaculty}
					value={faculty}
					values={faculties}
				/>
				<FilterSelect
					label="Sort"
					onChange={(value) => setSort(value as SortOption)}
					value={sort}
					values={["updated-desc", "name-asc", "name-desc", "status"]}
				/>
				<FilterSelect
					label="Any Document"
					onChange={setDocumentFilter}
					value={documentFilter}
					values={["portfolio", "businessPlan", "csrReport"]}
				/>
				<Button
					className="rounded-[8px]"
					onClick={fetchSubmissions}
					variant="outline"
				>
					Refresh
				</Button>
			</div>

			{error ? (
				<p className="rounded-xl border border-red-500/30 bg-red-900/20 p-4 text-red-200 text-sm">
					{error}
				</p>
			) : null}

			<div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/50">
				{loading ? (
					<div className="flex items-center justify-center gap-2 p-10 text-slate-400">
						<Loader2 className="size-5 animate-spin" /> Loading submissions...
					</div>
				) : filteredSubmissions.length === 0 ? (
					<p className="p-10 text-center text-slate-400">
						No portfolio submissions found.
					</p>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-sm">
							<thead className="border-slate-700/50 border-b text-slate-400">
								<tr>
									<th className="p-4">Applicant</th>
									<th className="p-4">Academic</th>
									<th className="p-4">Documents</th>
									<th className="p-4">Status</th>
									<th className="p-4">Updated</th>
									<th className="p-4">Action</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-700/50">
								{filteredSubmissions.map((submission) => (
									<tr
										className="hover:bg-slate-800/30"
										key={submission.applicationId}
									>
										<td className="p-4">
											<p className="font-medium text-slate-100">
												{submission.applicant.name ?? "—"}
											</p>
											<p className="text-slate-400 text-xs">
												{submission.applicant.email}
											</p>
											<p className="text-slate-500 text-xs">
												{submission.applicant.mobileNumber}
											</p>
										</td>
										<td className="p-4 text-slate-300">
											<p>{submission.academic.faculty ?? "—"}</p>
											<p className="text-slate-400 text-xs">
												{submission.academic.universityRegistrationNumber}
											</p>
										</td>
										<td className="p-4">
											<div className="flex flex-wrap gap-1.5">
												{(
													[
														"portfolio",
														"businessPlan",
														"csrReport",
													] as DocumentType[]
												).map((documentType) => (
													<DocumentPill
														key={documentType}
														state={documentState(submission, documentType)}
													>
														{DOCUMENT_LABELS[documentType]}
													</DocumentPill>
												))}
											</div>
										</td>
										<td className="p-4">
											<span
												className={statusBadge(submission.submissionStatus)}
											>
												{submission.submissionStatus}
											</span>
										</td>
										<td className="p-4 text-slate-400 text-xs">
											{formatDate(submission.updatedAt)}
										</td>
										<td className="p-4">
											<div className="flex items-center gap-2">
												<Button
													className="rounded-[8px]"
													onClick={() => setSelected(submission)}
													size="sm"
													variant="outline"
												>
													View
												</Button>
												<DownloadAllButton
													applicationId={submission.applicationId}
													hasUploadedDocuments={uploadedDocumentCount(
														submission,
													)}
												/>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			<SubmissionDialog
				submission={selected}
				onClose={() => setSelected(null)}
			/>
		</section>
	);
}

function DownloadAllButton({
	applicationId,
	hasUploadedDocuments,
}: {
	applicationId: string;
	hasUploadedDocuments: number;
}) {
	const [isDownloading, setIsDownloading] = useState(false);
	const [error, setError] = useState("");

	if (!hasUploadedDocuments) {
		return (
			<span
				className="text-slate-500 text-xs"
				title="No uploaded documents to download"
			>
				No files
			</span>
		);
	}

	async function downloadAll() {
		setIsDownloading(true);
		setError("");
		try {
			// Streamed as a file download so large archives never sit in memory.
			const link = document.createElement("a");
			link.href = `/api/admin/submissions/${applicationId}/download-all`;
			link.rel = "noopener";
			document.body.append(link);
			link.click();
			link.remove();
		} catch (downloadError) {
			setError(
				downloadError instanceof Error
					? downloadError.message
					: "Download failed",
			);
		} finally {
			setIsDownloading(false);
		}
	}

	return (
		<span className="inline-flex flex-col items-end gap-1">
			<Button
				className="rounded-[8px]"
				disabled={isDownloading}
				onClick={downloadAll}
				size="sm"
				variant="outline"
			>
				{isDownloading ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<Download className="size-4" />
				)}
				Download Files
			</Button>
			{error ? (
				<span className="text-destructive text-xs" role="alert">
					{error}
				</span>
			) : null}
		</span>
	);
}

function FilterSelect({
	label,
	onChange,
	value,
	values,
}: {
	label: string;
	onChange: (value: string) => void;
	value: string;
	values: string[];
}) {
	return (
		<Select onValueChange={onChange} value={value}>
			<SelectTrigger className="w-full bg-transparent dark:bg-input/30">
				<SelectValue placeholder={label} />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="all">{label}</SelectItem>
				{values.map((item) => (
					<SelectItem key={item} value={item}>
						{item.replaceAll("-", " ")}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function DocumentPill({
	children,
	state,
}: {
	children: React.ReactNode;
	state: string;
}) {
	const className =
		state === "uploaded"
			? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
			: state === "missing"
				? "border-amber-400/30 bg-amber-400/10 text-amber-200"
				: "border-slate-600 bg-slate-800/40 text-slate-500";
	return (
		<span className={`rounded-full border px-2 py-0.5 text-xs ${className}`}>
			{state === "uploaded" ? "✓" : state === "missing" ? "○" : "—"} {children}
		</span>
	);
}

function SubmissionDialog({
	submission,
	onClose,
}: {
	submission: SubmissionReview | null;
	onClose: () => void;
}) {
	if (!submission) return null;
	const activeSubmission = submission;

	async function openDocument(documentType: DocumentType) {
		const response = await fetch(
			`/api/admin/submissions/${activeSubmission.applicationId}/download?documentType=${documentType}`,
		);
		const data = await response.json();
		if (response.ok && data.url)
			window.open(data.url, "_blank", "noopener,noreferrer");
	}

	return (
		<Dialog open={Boolean(submission)} onOpenChange={onClose}>
			<DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-2xl border-slate-700/50 bg-slate-900 text-slate-100">
				<DialogHeader>
					<DialogTitle className="font-title text-2xl">
						Submission Review
					</DialogTitle>
					<DialogDescription>
						{submission.applicationReferenceNumber ?? submission.applicationId}
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-6 text-sm">
					<InfoGrid
						title="Student details"
						items={[
							["Name", submission.applicant.name],
							["Email", submission.applicant.email],
							["NIC", submission.applicant.nic],
							["Mobile", submission.applicant.mobileNumber],
						]}
					/>
					<InfoGrid
						title="Academic details"
						items={[
							["University", submission.academic.university],
							["Faculty", submission.academic.faculty],
							["Year", submission.academic.academicYear],
							["Degree", submission.academic.degree],
							[
								"Registration No",
								submission.academic.universityRegistrationNumber,
							],
						]}
					/>
					<section className="border-slate-700/50 border-t pt-4">
						<p className="mb-3 font-medium text-slate-400">Applied awards</p>
						<div className="flex flex-wrap gap-2">
							{submission.selectedAwards.map((award) => (
								<span
									className="rounded-full border border-blue-600/20 bg-blue-600/15 px-3 py-1 text-blue-300 text-xs"
									key={award}
								>
									{getAwardLabel(award)}
								</span>
							))}
						</div>
					</section>
					<section className="border-slate-700/50 border-t pt-4">
						<p className="mb-3 font-medium text-slate-400">
							Submitted documents
						</p>
						<div className="grid gap-3 md:grid-cols-3">
							{(
								["portfolio", "businessPlan", "csrReport"] as DocumentType[]
							).map((documentType) => {
								const file = submission.documents[documentType];
								const state = documentState(submission, documentType);
								return (
									<div
										className="rounded-xl border border-slate-700/60 bg-background/40 p-4"
										key={documentType}
									>
										<FileText className="mb-2 size-5 text-amber-300" />
										<p className="font-medium">
											{DOCUMENT_LABELS[documentType]}
										</p>
										<p className="mt-1 text-slate-400 text-xs">{state}</p>
										<p className="mt-2 truncate text-slate-300 text-xs">
											{file?.originalFileName ?? "—"}
										</p>
										<p className="text-slate-500 text-xs">
											{formatFileSize(file?.sizeBytes)}
										</p>
										{file?.objectPath ? (
											<Button
												className="mt-3 w-full rounded-[8px]"
												onClick={() => openDocument(documentType)}
												size="sm"
												variant="outline"
											>
												<ExternalLink className="mr-2 size-4" />
												Open PDF
											</Button>
										) : null}
									</div>
								);
							})}
						</div>
					</section>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function InfoGrid({
	items,
	title,
}: {
	items: Array<[string, string | undefined]>;
	title: string;
}) {
	return (
		<section className="border-slate-700/50 border-t pt-4 first:border-t-0 first:pt-0">
			<p className="mb-3 font-medium text-slate-400">{title}</p>
			<div className="grid gap-4 md:grid-cols-2">
				{items.map(([label, value]) => (
					<div key={label}>
						<p className="text-slate-500 text-xs">{label}</p>
						<p className="text-slate-200">{value || "—"}</p>
					</div>
				))}
			</div>
		</section>
	);
}
