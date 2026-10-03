import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import type { ClaimedRegistrationMessage, MessageClaimResult } from "../types";

const UPDATED_APPLICATIONS_COLLECTION = "updatedApplications";

/** Reads a non-empty string from a Firestore field. */
function readString(value: unknown) {
	return typeof value === "string" ? value.trim() : "";
}

/** Extracts active awards that contain all fields required by the email. */
function readActiveAwards(
	value: unknown,
): ClaimedRegistrationMessage["awards"] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((award: unknown) => {
		if (!award || typeof award !== "object") return [];
		const data = award as FirebaseFirestore.DocumentData;
		if (data.status === "removed") return [];
		const awardLabel = readString(data.awardLabel);
		const registrationNumber = readString(data.registrationNumber);
		const whatsappUrl = readString(data.whatsappUrl);
		if (!awardLabel || !registrationNumber || !whatsappUrl) return [];
		return [{ awardLabel, registrationNumber, whatsappUrl }];
	});
}

/** Claims one sendable record before any external email request is made. */
export async function claimMessageForSending(
	applicationId: string,
): Promise<MessageClaimResult> {
	const db = getAdminDb();
	const reference = db
		.collection(UPDATED_APPLICATIONS_COLLECTION)
		.doc(applicationId);

	return db.runTransaction(async (transaction) => {
		const snapshot = await transaction.get(reference);
		if (!snapshot.exists) {
			return {
				claimed: false,
				applicationId,
				applicationReferenceNumber: null,
				reason: "Updated application was not found.",
			};
		}
		const data = snapshot.data() ?? {};
		const applicationReferenceNumber = readString(
			data.applicationReferenceNumber,
		);
		const recipient = (data.recipient ?? {}) as FirebaseFirestore.DocumentData;
		const recipientName = readString(recipient.name);
		const recipientEmail = readString(recipient.email);
		const awards = readActiveAwards(data.awardRegistrations);
		if (
			!applicationReferenceNumber ||
			!recipientName ||
			!recipientEmail ||
			awards.length === 0
		) {
			return {
				claimed: false,
				applicationId,
				applicationReferenceNumber: applicationReferenceNumber || null,
				reason: "Registration email data is incomplete.",
			};
		}

		const emailDispatch = (data.emailDispatch ??
			{}) as FirebaseFirestore.DocumentData;
		const currentStatus = readString(emailDispatch.status) || "not_sent";
		const sendableStatuses = new Set([
			"not_sent",
			"failed",
			"accepted",
			"delivered",
			"bounced",
			"complained",
		]);
		if (!sendableStatuses.has(currentStatus)) {
			return {
				claimed: false,
				applicationId,
				applicationReferenceNumber,
				reason: `Message cannot be sent while status is ${currentStatus}.`,
			};
		}

		const previousSendCount =
			typeof emailDispatch.sendCount === "number" &&
			emailDispatch.sendCount >= 0
				? emailDispatch.sendCount
				: 0;
		const attempt = previousSendCount + 1;
		transaction.update(reference, {
			"emailDispatch.status": "processing",
			"emailDispatch.sendCount": attempt,
			"emailDispatch.lastError": null,
			updatedAt: FieldValue.serverTimestamp(),
		});

		return {
			claimed: true,
			message: {
				applicationId,
				applicationReferenceNumber,
				attempt,
				recipient: { name: recipientName, email: recipientEmail },
				awards,
			},
		};
	});
}

/** Marks a claimed message accepted only when the same attempt still owns it. */
export async function markMessageAccepted(
	message: ClaimedRegistrationMessage,
	resendEmailId: string,
) {
	const db = getAdminDb();
	const reference = db
		.collection(UPDATED_APPLICATIONS_COLLECTION)
		.doc(message.applicationId);

	return db.runTransaction(async (transaction) => {
		const snapshot = await transaction.get(reference);
		if (!snapshot.exists) return false;
		const data = snapshot.data() ?? {};
		const emailDispatch = (data.emailDispatch ??
			{}) as FirebaseFirestore.DocumentData;
		if (
			emailDispatch.status !== "processing" ||
			emailDispatch.sendCount !== message.attempt
		) {
			return false;
		}

		const now = FieldValue.serverTimestamp();
		transaction.update(reference, {
			"emailDispatch.status": "accepted",
			"emailDispatch.latestResendEmailId": resendEmailId,
			"emailDispatch.firstSentAt": emailDispatch.firstSentAt ?? now,
			"emailDispatch.lastSentAt": now,
			"emailDispatch.lastError": null,
			updatedAt: now,
		});
		return true;
	});
}

/** Records a rejected or failed Resend request for the owning attempt. */
export async function markMessageFailed(
	message: ClaimedRegistrationMessage,
	errorMessage: string,
) {
	const db = getAdminDb();
	const reference = db
		.collection(UPDATED_APPLICATIONS_COLLECTION)
		.doc(message.applicationId);

	return db.runTransaction(async (transaction) => {
		const snapshot = await transaction.get(reference);
		if (!snapshot.exists) return false;
		const data = snapshot.data() ?? {};
		const emailDispatch = (data.emailDispatch ??
			{}) as FirebaseFirestore.DocumentData;
		if (
			emailDispatch.status !== "processing" ||
			emailDispatch.sendCount !== message.attempt
		) {
			return false;
		}

		transaction.update(reference, {
			"emailDispatch.status": "failed",
			"emailDispatch.lastError": errorMessage.slice(0, 1000),
			updatedAt: FieldValue.serverTimestamp(),
		});
		return true;
	});
}
