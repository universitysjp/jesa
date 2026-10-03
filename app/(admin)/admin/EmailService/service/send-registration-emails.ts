"use server";

import { getAdminUserFromCookies } from "@/app/admin/lib/server-auth";
import {
	claimMessageForSending,
	markMessageAccepted,
	markMessageFailed,
} from "./db-transaction/message-dispatch-transaction";
import { sendClaimedRegistrationEmail } from "./resend-email-service";
import type {
	MessageClaimResult,
	MessageSendBatchResult,
	MessageSendResult,
} from "./types";

const MAX_MESSAGES_PER_BATCH = 50;

/** Removes duplicate and empty IDs and enforces a safe sequential batch size. */
function normalizeMessageIds(applicationIds: string[]) {
	const uniqueIds = [
		...new Set(
			applicationIds
				.filter((id): id is string => typeof id === "string")
				.map((id) => id.trim())
				.filter(Boolean),
		),
	];
	if (uniqueIds.length > MAX_MESSAGES_PER_BATCH) {
		throw new Error(
			`Select no more than ${MAX_MESSAGES_PER_BATCH} messages per batch.`,
		);
	}
	return uniqueIds;
}

/** Claims and sends selected registration emails one application at a time. */
export async function sendRegistrationEmails(
	applicationIds: string[],
): Promise<MessageSendBatchResult> {
	const admin = await getAdminUserFromCookies();
	if (!admin) throw new Error("Unauthorized");

	const uniqueIds = normalizeMessageIds(applicationIds);
	const results: MessageSendResult[] = [];
	for (const applicationId of uniqueIds) {
		let claim: MessageClaimResult;
		try {
			claim = await claimMessageForSending(applicationId);
		} catch (error) {
			results.push({
				applicationId,
				applicationReferenceNumber: null,
				status: "failed",
				message:
					error instanceof Error ? error.message : "Message claim failed.",
				resendEmailId: null,
			});
			continue;
		}
		if (!claim.claimed) {
			results.push({
				applicationId,
				applicationReferenceNumber: claim.applicationReferenceNumber,
				status: "skipped",
				message: claim.reason,
				resendEmailId: null,
			});
			continue;
		}

		let resendEmailId: string | null = null;
		try {
			resendEmailId = await sendClaimedRegistrationEmail(claim.message);
			const finalized = await markMessageAccepted(claim.message, resendEmailId);
			if (!finalized) {
				throw new Error(
					"Resend accepted the email, but the dispatch record changed before finalization.",
				);
			}
			results.push({
				applicationId,
				applicationReferenceNumber: claim.message.applicationReferenceNumber,
				status: "accepted",
				message: "Resend accepted the registration email.",
				resendEmailId,
			});
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Registration email failed.";
			try {
				await markMessageFailed(claim.message, message);
			} catch (finalizationError) {
				console.error(
					`[sendRegistrationEmails] Failed to record ${applicationId}:`,
					finalizationError,
				);
			}
			results.push({
				applicationId,
				applicationReferenceNumber: claim.message.applicationReferenceNumber,
				status: "failed",
				message,
				resendEmailId,
			});
		}
	}

	return {
		total: results.length,
		accepted: results.filter((result) => result.status === "accepted").length,
		skipped: results.filter((result) => result.status === "skipped").length,
		failed: results.filter((result) => result.status === "failed").length,
		results,
	};
}
