import { getAdminDb } from "@/lib/firebase-admin";
import type { UpdatedApplicationMessageDocument } from "../types";

const UPDATED_APPLICATIONS_COLLECTION = "updatedApplications";

/** Reads message-related documents without modifying registration data. */
export async function fetchUpdatedApplicationMessages(): Promise<
	UpdatedApplicationMessageDocument[]
> {
	const snapshot = await getAdminDb()
		.collection(UPDATED_APPLICATIONS_COLLECTION)
		.get();

	return snapshot.docs.map((document) => ({
		documentId: document.id,
		data: document.data(),
	}));
}
