"use server";

import { getAdminUserFromCookies } from "@/app/admin/lib/server-auth";
import { getAwardLabel } from "@/lib/awards";
import { fetchApplicationRegistrationPairs } from "./registration-database";
import type {
	RegistrationLookupItem,
	SourceApplication,
	UpdatedApplication,
} from "./types";

/** Builds one display record and checks every selected award registration. */
function buildLookupItem(
	source: SourceApplication,
	updated: UpdatedApplication | null,
): RegistrationLookupItem {
	const activeRegistrations = new Map(
		(updated?.awardRegistrations ?? [])
			.filter((award) => award.status === "active")
			.map((award) => [award.awardCode, award.registrationNumber]),
	);
	const awards = source.selectedAwards.map((awardCode) => ({
		awardCode,
		awardLabel: getAwardLabel(awardCode),
		registrationNumber: activeRegistrations.get(awardCode) || null,
	}));
	const missingRegistrationCount = awards.filter(
		(award) => !award.registrationNumber,
	).length;
	const hasApplicationReference = Boolean(
		updated?.applicationReferenceNumber.trim(),
	);

	return {
		applicationId: source.applicationId,
		applicationReferenceNumber:
			updated?.applicationReferenceNumber.trim() || null,
		applicantType: source.applicantType,
		recipient: source.recipient,
		isRegistered:
			Boolean(updated) &&
			hasApplicationReference &&
			missingRegistrationCount === 0,
		awards,
		missingRegistrationCount,
		createdAt: updated?.createdAt ?? source.createdAt ?? null,
	};
}

/** Returns all original applications with their current registration state. */
export async function getRegistrationLookup(): Promise<
	RegistrationLookupItem[]
> {
	const admin = await getAdminUserFromCookies();
	if (!admin) throw new Error("Unauthorized");

	const pairs = await fetchApplicationRegistrationPairs();
	return pairs
		.map(({ source, updated }) => buildLookupItem(source, updated))
		.sort((left, right) =>
			left.recipient.name.localeCompare(right.recipient.name),
		);
}
