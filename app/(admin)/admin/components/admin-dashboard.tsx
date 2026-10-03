"use client";

import ExcelJS from "exceljs";
import { AlertCircle, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/admin/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { getAwardLabel } from "@/lib/awards";
import AdminRequests from "./admin-requests";
import ApplicationsTable from "./dashboard/applications-table";
import AwardsBreakdown from "./dashboard/awards-breakdown";
import BulkActions from "./dashboard/bulk-actions";
import DeleteDialog from "./dashboard/delete-dialog";
import DetailDialog from "./dashboard/detail-dialog";
import Filters from "./dashboard/filters";
import MobileCards from "./dashboard/mobile-cards";
import StatsCards from "./dashboard/stats-cards";
import type {
	Application,
	ApplicationStatus,
	DashboardFilters,
} from "./dashboard/types";
import SubmissionsReview from "./submissions-review";

interface AdminDashboardProps {
	userEmail: string;
	userName?: string | null;
	isSuperAdmin: boolean;
}

type AdminTab = "overview" | "list" | "submissions" | "iam";

const INITIAL_FILTERS: DashboardFilters = {
	search: "",
	type: "all",
	category: "all",
	award: "all",
	university: "all",
	faculty: "all",
	academicYear: "all",
	gender: "all",
	status: "all",
	dateFrom: "",
	dateTo: "",
};

export default function AdminDashboard({
	userEmail,
	userName,
	isSuperAdmin,
}: AdminDashboardProps) {
	const { signOut } = useAuth();

	const [applications, setApplications] = useState<Application[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [filters, setFilters] = useState<DashboardFilters>(INITIAL_FILTERS);
	const [selected, setSelected] = useState<Application | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [bulkLoading, setBulkLoading] = useState(false);
	const [activeTab, setActiveTab] = useState<AdminTab>("overview");

	const fetchApplications = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const res = await fetch("/api/admin/applications");
			if (!res.ok) throw new Error("Failed to fetch applications");
			const data = await res.json();
			setApplications(data.applications || []);
			setSelectedIds([]);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchApplications();
	}, [fetchApplications]);

	const filteredApplications = useMemo(() => {
		return applications.filter((app) => {
			const term = filters.search.toLowerCase().trim();
			const matchesSearch =
				!term ||
				app.personalInfo?.publicDisplayName?.toLowerCase().includes(term) ||
				app.personalInfo?.email?.toLowerCase().includes(term) ||
				app.personalInfo?.nic?.toLowerCase().includes(term) ||
				app.academicInfo?.university?.toLowerCase().includes(term) ||
				app.academicInfo?.universityRegistrationNumber
					?.toLowerCase()
					.includes(term) ||
				app.academicInfo?.universityEmail?.toLowerCase().includes(term) ||
				app.personalInfo?.whatsappNumber?.toLowerCase().includes(term);

			const matchesType =
				filters.type === "all" || app.applicantType === filters.type;

			const matchesAward =
				filters.award === "all" ||
				app.awardSelection?.selectedAwards?.includes(filters.award);

			const matchesCategory =
				filters.category === "all" ||
				app.awardSelection?.selectedAwards?.some((award) => {
					if (filters.category === "besa") return award.startsWith("besa-");
					return !award.startsWith("besa-");
				});

			const matchesUniversity =
				filters.university === "all" ||
				app.academicInfo?.university === filters.university;

			const matchesFaculty =
				filters.faculty === "all" ||
				app.academicInfo?.faculty === filters.faculty;

			const matchesAcademicYear =
				filters.academicYear === "all" ||
				app.academicInfo?.academicYear === filters.academicYear;

			const matchesGender =
				filters.gender === "all" || app.personalInfo?.gender === filters.gender;

			const matchesStatus =
				filters.status === "all" || app.status === filters.status;

			const submittedAt = app.submittedAt ? new Date(app.submittedAt) : null;
			const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : null;
			const toDate = filters.dateTo ? new Date(filters.dateTo) : null;

			const matchesDateFrom =
				!fromDate || !submittedAt || submittedAt >= fromDate;
			const matchesDateTo = !toDate || !submittedAt || submittedAt <= toDate;

			return (
				matchesSearch &&
				matchesType &&
				matchesAward &&
				matchesCategory &&
				matchesUniversity &&
				matchesFaculty &&
				matchesAcademicYear &&
				matchesGender &&
				matchesStatus &&
				matchesDateFrom &&
				matchesDateTo
			);
		});
	}, [applications, filters]);

	const handleDelete = async () => {
		if (!deleteTarget) return;
		setDeleting(true);
		try {
			const res = await fetch(`/api/admin/applications/${deleteTarget.id}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Failed to delete");
			setApplications((prev) => prev.filter((a) => a.id !== deleteTarget.id));
			setDeleteTarget(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Delete failed");
		} finally {
			setDeleting(false);
		}
	};

	const handleStatusChange = async (id: string, status: ApplicationStatus) => {
		try {
			const res = await fetch(`/api/admin/applications/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status }),
			});
			if (!res.ok) throw new Error("Failed to update status");
			setApplications((prev) =>
				prev.map((app) => (app.id === id ? { ...app, status } : app)),
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Status update failed");
		}
	};

	const handleBulkStatusChange = async (status: ApplicationStatus) => {
		setBulkLoading(true);
		try {
			const res = await fetch("/api/admin/applications/bulk", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ids: selectedIds, action: "status", status }),
			});
			if (!res.ok) throw new Error("Failed to update statuses");
			setApplications((prev) =>
				prev.map((app) =>
					selectedIds.includes(app.id) ? { ...app, status } : app,
				),
			);
			setSelectedIds([]);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Bulk update failed");
		} finally {
			setBulkLoading(false);
		}
	};

	const handleBulkDelete = async () => {
		setBulkLoading(true);
		try {
			const res = await fetch("/api/admin/applications/bulk", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ids: selectedIds, action: "delete" }),
			});
			if (!res.ok) throw new Error("Failed to delete applications");
			setApplications((prev) =>
				prev.filter((app) => !selectedIds.includes(app.id)),
			);
			setSelectedIds([]);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Bulk delete failed");
		} finally {
			setBulkLoading(false);
		}
	};

	const toggleSelection = (id: string) => {
		setSelectedIds((prev) =>
			prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
		);
	};

	const selectAll = (ids: string[]) => {
		setSelectedIds(ids);
	};

	const exportJson = () => {
		const blob = new Blob([JSON.stringify(filteredApplications, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `jesa-applications-${new Date().toISOString().split("T")[0]}.json`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const exportExcel = async () => {
		const workbook = new ExcelJS.Workbook();
		const worksheet = workbook.addWorksheet("Applications");

		worksheet.columns = [
			{ header: "ID", key: "id", width: 40 },
			{ header: "Type", key: "type", width: 12 },
			{ header: "Status", key: "status", width: 14 },
			{ header: "Name", key: "name", width: 28 },
			{ header: "NIC", key: "nic", width: 18 },
			{ header: "Email", key: "email", width: 32 },
			{ header: "WhatsApp", key: "whatsapp", width: 18 },
			{ header: "Mobile", key: "mobile", width: 18 },
			{ header: "Gender", key: "gender", width: 12 },
			{ header: "University", key: "university", width: 42 },
			{ header: "Reg No", key: "regNo", width: 22 },
			{ header: "University Email", key: "uniEmail", width: 32 },
			{ header: "Academic Year", key: "academicYear", width: 20 },
			{ header: "Faculty", key: "faculty", width: 18 },
			{ header: "Degree", key: "degree", width: 36 },
			{ header: "Graduation Year", key: "graduationYear", width: 18 },
			{ header: "Awards", key: "awards", width: 48 },
			{ header: "Innovator Industry", key: "innovatorIndustry", width: 28 },
			{ header: ">75% Complete", key: "innovatorComplete", width: 16 },
			{ header: "CSR Advisor", key: "csrAdvisor", width: 32 },
			{ header: "CSR Advisor Email", key: "csrAdvisorEmail", width: 32 },
			{ header: "CSR Member", key: "csrMember", width: 24 },
			{ header: "CSR Member WhatsApp", key: "csrMemberWhatsapp", width: 20 },
			{ header: "CSR President", key: "csrPresident", width: 24 },
			{
				header: "CSR President WhatsApp",
				key: "csrPresidentWhatsapp",
				width: 20,
			},
			{ header: "CSR President Email", key: "csrPresidentEmail", width: 32 },
			{ header: "Submitted At", key: "submittedAt", width: 24 },
		];

		filteredApplications.forEach((app) => {
			worksheet.addRow({
				id: app.id,
				type: app.applicantType,
				status: app.status || "submitted",
				name: app.personalInfo?.publicDisplayName,
				nic: app.personalInfo?.nic,
				email: app.personalInfo?.email,
				whatsapp: app.personalInfo?.whatsappNumber,
				mobile: app.personalInfo?.mobileNumber,
				gender: app.personalInfo?.gender,
				university: app.academicInfo?.university,
				regNo: app.academicInfo?.universityRegistrationNumber,
				uniEmail: app.academicInfo?.universityEmail,
				academicYear: app.academicInfo?.academicYear,
				faculty: app.academicInfo?.faculty,
				degree: app.academicInfo?.degree,
				graduationYear: app.academicInfo?.graduationYear,
				awards: app.awardSelection?.selectedAwards
					?.map(getAwardLabel)
					.join(", "),
				innovatorIndustry:
					app.bestInnovatorQuestions?.industry === "Other"
						? app.bestInnovatorQuestions?.otherIndustry
						: app.bestInnovatorQuestions?.industry,
				innovatorComplete: app.bestInnovatorQuestions
					?.innovationCompletionPercentage
					? "Yes"
					: "No",
				csrAdvisor: app.bestCSRQuestions?.clubAdvisorNameTitle,
				csrAdvisorEmail: app.bestCSRQuestions?.clubAdvisorEmail,
				csrMember: app.bestCSRQuestions?.memberAttendingName,
				csrMemberWhatsapp: app.bestCSRQuestions?.memberAttendingWhatsapp,
				csrPresident: app.bestCSRQuestions?.clubPresidentName,
				csrPresidentWhatsapp: app.bestCSRQuestions?.clubPresidentWhatsapp,
				csrPresidentEmail: app.bestCSRQuestions?.clubPresidentEmail,
				submittedAt: app.submittedAt,
			});
		});

		const buffer = await workbook.xlsx.writeBuffer();
		const blob = new Blob([buffer], {
			type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `jesa-applications-${new Date().toISOString().split("T")[0]}.xlsx`;
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<div className="min-h-screen bg-slate-950 pb-16">
			<div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 pb-8">
				<div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6 md:p-8 backdrop-blur-sm">
					<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
						<div>
							<h1 className="bg-[linear-gradient(92deg,rgba(255,255,255,0.60)_6.46%,#FFF_22.73%,rgba(255,255,255,1.00)_79.27%,rgba(255,255,255,0.50)_95.93%)] bg-clip-text font-title text-[32px] text-transparent leading-[1.125] tracking-tight md:text-[40px]">
								Admin Dashboard
							</h1>
							<p className="mt-2 text-slate-400 text-sm">
								Signed in as {userName || userEmail}
								{isSuperAdmin && (
									<span className="ml-2 inline-flex items-center rounded-full bg-amber-600/15 px-2 py-0.5 text-xs text-amber-300 border border-amber-600/20">
										Super Admin
									</span>
								)}
							</p>
						</div>
						<div className="flex gap-2">
							<Button
								onClick={fetchApplications}
								variant="outline"
								disabled={loading}
								className="rounded-[8px] border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
							>
								{loading ? (
									<Loader2 className="w-4 h-4 animate-spin" />
								) : (
									"Refresh"
								)}
							</Button>
							<Button
								variant="outline"
								onClick={() =>
									signOut().then(() => (window.location.href = "/"))
								}
								className="rounded-[8px] border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
							>
								Sign Out
							</Button>
						</div>
					</div>

					{error && (
						<div className="mb-6 p-4 rounded-2xl bg-red-900/30 border border-red-500/40 flex items-start gap-3">
							<AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
							<p className="text-sm text-red-200">{error}</p>
						</div>
					)}

					<div className="flex flex-wrap items-center gap-2 mb-8 border-b border-slate-700/50 pb-6">
						<Button
							variant={activeTab === "overview" ? "default" : "outline"}
							onClick={() => setActiveTab("overview")}
							className={`rounded-[8px] ${
								activeTab === "overview"
									? "bg-slate-100 text-slate-900 hover:bg-white"
									: "border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
							}`}
						>
							Overview
						</Button>
						<Button
							variant={activeTab === "list" ? "default" : "outline"}
							onClick={() => setActiveTab("list")}
							className={`rounded-[8px] ${
								activeTab === "list"
									? "bg-slate-100 text-slate-900 hover:bg-white"
									: "border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
							}`}
						>
							Applications List
						</Button>
						<Button
							variant={activeTab === "submissions" ? "default" : "outline"}
							onClick={() => setActiveTab("submissions")}
							className={`rounded-[8px] ${
								activeTab === "submissions"
									? "bg-slate-100 text-slate-900 hover:bg-white"
									: "border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
							}`}
						>
							Portfolio Submissions
						</Button>
						{isSuperAdmin && (
							<Button
								variant={activeTab === "iam" ? "default" : "outline"}
								onClick={() => setActiveTab("iam")}
								className={`rounded-[8px] ${
									activeTab === "iam"
										? "bg-slate-100 text-slate-900 hover:bg-white"
										: "border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
								}`}
							>
								IAM & Requests
							</Button>
						)}
					</div>

					{activeTab === "overview" && (
						<>
							<StatsCards applications={applications} />
							<AwardsBreakdown applications={applications} />
						</>
					)}

					{activeTab === "list" && (
						<>
							<Filters
								filters={filters}
								onChange={setFilters}
								applications={applications}
								onExportExcel={exportExcel}
								onExportJson={exportJson}
							/>

							<BulkActions
								selectedCount={selectedIds.length}
								onStatusChange={handleBulkStatusChange}
								onDelete={handleBulkDelete}
								loading={bulkLoading}
							/>

							<div className="hidden lg:block">
								<ApplicationsTable
									applications={filteredApplications}
									loading={loading}
									selectedIds={selectedIds}
									onSelect={toggleSelection}
									onSelectAll={selectAll}
									onView={setSelected}
									onDelete={setDeleteTarget}
									onStatusChange={handleStatusChange}
								/>
							</div>

							<div className="lg:hidden">
								<MobileCards
									applications={filteredApplications}
									loading={loading}
									selectedIds={selectedIds}
									onSelect={toggleSelection}
									onView={setSelected}
									onDelete={setDeleteTarget}
									onStatusChange={handleStatusChange}
								/>
							</div>
						</>
					)}

					{activeTab === "submissions" && <SubmissionsReview />}
				</div>

				{activeTab === "iam" && isSuperAdmin && (
					<div className="mt-8">
						<AdminRequests userEmail={userEmail} />
					</div>
				)}
			</div>

			<DetailDialog application={selected} onClose={() => setSelected(null)} />

			<DeleteDialog
				application={deleteTarget}
				loading={deleting}
				onClose={() => setDeleteTarget(null)}
				onConfirm={handleDelete}
			/>
		</div>
	);
}
