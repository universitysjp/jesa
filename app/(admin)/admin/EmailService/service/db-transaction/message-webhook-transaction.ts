import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import type { MessageDispatchStatus } from "../types";

type MessageWebhookInput = {
	eventId: string;
	type: string;
	data: Record<string, unknown>;
};

const STATUS_BY_EVENT: Record<string, MessageDispatchStatus> = {
	"email.sent": "accepted",
	"email.delivered": "delivered",
	"email.bounced": "bounced",
	"email.complained": "complained",
	"email.failed": "failed",
};

/** Prevents delayed webhook events from downgrading a final dispatch state. */
function canApplyStatus(
	currentStatus: MessageDispatchStatus,
	nextStatus: MessageDispatchStatus,
) {
	if (currentStatus === "complained") return false;
	if (nextStatus === "accepted") {
		return currentStatus === "not_sent" || currentStatus === "processing";
	}
	if (nextStatus === "delivered") {
		return currentStatus !== "bounced";
	}
	if (nextStatus === "bounced") {
		return currentStatus !== "delivered";
	}
	if (nextStatus === "failed") {
		return currentStatus !== "delivered" && currentStatus !== "bounced";
	}
	return true;
}

/** Normalizes an unknown stored status before transition checks. */
function readCurrentStatus(value: unknown): MessageDispatchStatus {
	return value === "processing" ||
		value === "accepted" ||
		value === "delivered" ||
		value === "failed" ||
		value === "bounced" ||
		value === "complained"
		? value
		: "not_sent";
}

/** Returns the stored error message for a terminal webhook status. */
function getStatusError(status: MessageDispatchStatus) {
	if (status === "bounced") return "Resend reported that the email bounced.";
	if (status === "complained") {
		return "The recipient reported this email as spam.";
	}
	if (status === "failed") return "Resend reported an email delivery failure.";
	return null;
}

/** Applies one verified Resend event to its matching updated application. */
export async function updateMessageFromWebhook({
	eventId,
	type,
	data,
}: MessageWebhookInput) {
	const nextStatus = STATUS_BY_EVENT[type];
	if (!nextStatus) return { handled: false, duplicate: false };
	const emailId = typeof data.email_id === "string" ? data.email_id.trim() : "";
	if (!emailId) throw new Error("Webhook event does not contain an email ID.");
	if (!/^[A-Za-z0-9_-]+$/.test(eventId)) {
		throw new Error("Webhook event ID is invalid.");
	}

	const db = getAdminDb();
	const messageSnapshot = await db
		.collection("updatedApplications")
		.where("emailDispatch.latestResendEmailId", "==", emailId)
		.limit(1)
		.get();
	if (messageSnapshot.empty) {
		throw new Error(`No message record found for Resend email ${emailId}.`);
	}

	const messageReference = messageSnapshot.docs[0].ref;
	const eventReference = db.collection("resendWebhookEvents").doc(eventId);
	return db.runTransaction(async (transaction) => {
		const [eventSnapshot, applicationSnapshot] = await Promise.all([
			transaction.get(eventReference),
			transaction.get(messageReference),
		]);
		if (eventSnapshot.exists) return { handled: true, duplicate: true };
		if (!applicationSnapshot.exists) {
			throw new Error("Updated application no longer exists.");
		}

		const application = applicationSnapshot.data() ?? {};
		const currentStatus = readCurrentStatus(application.emailDispatch?.status);
		if (canApplyStatus(currentStatus, nextStatus)) {
			const now = FieldValue.serverTimestamp();
			const updates: Record<string, unknown> = {
				"emailDispatch.status": nextStatus,
				updatedAt: now,
			};
			if (nextStatus === "delivered") {
				updates["emailDispatch.deliveredAt"] = now;
			}
			if (nextStatus === "bounced") {
				updates["emailDispatch.bouncedAt"] = now;
			}
			const statusError = getStatusError(nextStatus);
			if (statusError) updates["emailDispatch.lastError"] = statusError;
			transaction.update(messageReference, updates);
		}

		transaction.create(eventReference, {
			eventId,
			emailId,
			type,
			status: nextStatus,
			processedAt: FieldValue.serverTimestamp(),
		});
		return { handled: true, duplicate: false };
	});
}
