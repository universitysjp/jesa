"use server";

import { getAdminUserFromCookies } from "@/app/admin/lib/server-auth";
import { registerSingleApplication } from "./db-transaction/registration-transaction";
import { fetchApplicationsByIds } from "./fetch-applications";
import type {
	RegistrationActionResult,
	RegistrationBatchResult,
} from "./types";

/** Removes empty and duplicate application IDs before database access. */
function normalizeApplicationIds(applicationIds: string[]) {
	return [
		...new Set(
			applicationIds
				.filter((id): id is string => typeof id === "string")
				.map((id) => id.trim())
				.filter(Boolean),
		),
	];
}

/** Registers selected applications sequentially and returns a batch summary. */
export async function registerApplications(
	applicationIds: string[],
): Promise<RegistrationBatchResult> {
	const admin = await getAdminUserFromCookies();
	if (!admin) throw new Error("Unauthorized");

	const uniqueApplicationIds = normalizeApplicationIds(applicationIds);
	if (uniqueApplicationIds.length === 0) {
		return {
			total: 0,
			created: 0,
			updated: 0,
			skipped: 0,
			failed: 0,
			results: [],
		};
	}

	const applications = await fetchApplicationsByIds(uniqueApplicationIds);
	const applicationsById = new Map(
		applications.map((application) => [application.applicationId, application]),
	);
	const results: RegistrationActionResult[] = [];

	for (const applicationId of uniqueApplicationIds) {
		const application = applicationsById.get(applicationId);
		if (!application) {
			results.push({
				applicationId,
				applicationReferenceNumber: null,
				status: "failed",
				message: "Original application not found.",
				awardRegistrations: [],
			});
			continue;
		}

		try {
			results.push(await registerSingleApplication(application));
		} catch (error) {
			results.push({
				applicationId,
				applicationReferenceNumber: null,
				status: "failed",
				message:
					error instanceof Error
						? error.message
						: "Unknown registration error.",
				awardRegistrations: [],
			});
		}
	}

	return {
		total: results.length,
		created: results.filter((result) => result.status === "created").length,
		updated: results.filter((result) => result.status === "updated").length,
		skipped: results.filter((result) => result.status === "skipped").length,
		failed: results.filter((result) => result.status === "failed").length,
		results,
	};
}
