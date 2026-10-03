import { getAdminDb } from "@/lib/firebase-admin";
import type { RegistrationSourceApplication } from "./types";

const FIRESTORE_IN_LIMIT = 30;

/** Splits application IDs into Firestore-compatible `in` query groups. */
function chunkApplicationIds(applicationIds: string[]) {
	const chunks: string[][] = [];
	for (
		let index = 0;
		index < applicationIds.length;
		index += FIRESTORE_IN_LIMIT
	) {
		chunks.push(applicationIds.slice(index, index + FIRESTORE_IN_LIMIT));
	}
	return chunks;
}

/** Checks whether a document contains the fields required for registration. */
function isRegistrationSourceApplication(
	value: unknown,
): value is RegistrationSourceApplication {
	if (!value || typeof value !== "object") return false;
	const application = value as Partial<RegistrationSourceApplication>;
	return (
		typeof application.applicationId === "string" &&
		(application.applicantType === "internal" ||
			application.applicantType === "external") &&
		Array.isArray(application.awardSelection?.selectedAwards) &&
		typeof application.personalInfo?.publicDisplayName === "string" &&
		typeof application.personalInfo?.email === "string"
	);
}

/** Fetches original applications whose applicationId is in the supplied array. */
export async function fetchApplicationsByIds(
	applicationIds: string[],
): Promise<RegistrationSourceApplication[]> {
	if (applicationIds.length === 0) return [];
	const db = getAdminDb();
	const applications: RegistrationSourceApplication[] = [];

	for (const applicationIdChunk of chunkApplicationIds(applicationIds)) {
		const snapshot = await db
			.collection("applications")
			.where("applicationId", "in", applicationIdChunk)
			.get();
		for (const document of snapshot.docs) {
			const application = document.data();
			if (isRegistrationSourceApplication(application)) {
				applications.push(application);
			}
		}
	}

	return applications;
}
