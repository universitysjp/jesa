"use server";

import { getAdminUserFromCookies } from "@/app/admin/lib/server-auth";
import { WHATSAPP_LINKS } from "@/constants/whatsapp-links";
import { fetchUpdatedApplicationMessages } from "./db-transaction/message-query";
import type {
	MessageDispatchStatus,
	MessageRecord,
	MessageRecordAward,
	UpdatedApplicationMessageDocument,
} from "./types";

const MESSAGE_STATUSES = new Set<MessageDispatchStatus>([
	"not_sent",
	"processing",
	"accepted",
	"delivered",
	"failed",
	"bounced",
	"complained",
]);

/** Returns a supported dispatch status or the safe not-sent default. */
function readMessageStatus(value: unknown): MessageDispatchStatus {
	return typeof value === "string" &&
		MESSAGE_STATUSES.has(value as MessageDispatchStatus)
		? (value as MessageDispatchStatus)
		: "not_sent";
}

/** Converts Firestore timestamps and serialized dates into ISO strings. */
function serializeDate(value: unknown): string | null {
	if (!value) return null;
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "string") return value;
	if (typeof value === "object" && "toDate" in value) {
		const toDate = (value as { toDate?: unknown }).toDate;
		if (typeof toDate === "function") {
			return (toDate.call(value) as Date).toISOString();
		}
	}
	return null;
}

/** Converts an updatedApplications document into a safe client message record. */
function buildMessageRecord(
	document: UpdatedApplicationMessageDocument,
): MessageRecord | null {
	const { data } = document;
	const applicationId =
		typeof data.applicationId === "string"
			? data.applicationId.trim()
			: document.documentId;
	const registrationNumber =
		typeof data.applicationReferenceNumber === "string"
			? data.applicationReferenceNumber.trim()
			: "";
	const recipient = data.recipient as
		| FirebaseFirestore.DocumentData
		| undefined;
	if (
		!applicationId ||
		!registrationNumber ||
		typeof recipient?.name !== "string" ||
		typeof recipient.email !== "string"
	) {
		return null;
	}
	const emailDispatch = (data.emailDispatch ??
		{}) as FirebaseFirestore.DocumentData;
	const awards: MessageRecordAward[] = Array.isArray(data.awardRegistrations)
		? data.awardRegistrations.flatMap((award: unknown) => {
				if (!award || typeof award !== "object") return [];
				const value = award as FirebaseFirestore.DocumentData;
				if (
					value.status === "removed" ||
					typeof value.awardLabel !== "string"
				) {
					return [];
				}
				const awardCode =
					typeof value.awardCode === "string" ? value.awardCode : "";
				const whatsappEntry = WHATSAPP_LINKS[awardCode];
				return [
					{
						label: value.awardLabel,
						registrationNumber:
							typeof value.registrationNumber === "string"
								? value.registrationNumber
								: "",
						whatsappUrl: whatsappEntry?.url || "",
					},
				];
			})
		: [];

	return {
		applicationId,
		registrationNumber,
		recipient: {
			name: recipient.name.trim(),
			email: recipient.email.trim(),
		},
		awards,
		status: readMessageStatus(emailDispatch.status),
		sendCount:
			typeof emailDispatch.sendCount === "number" ? emailDispatch.sendCount : 0,
		lastSentAt: serializeDate(emailDispatch.lastSentAt),
		updatedAt: serializeDate(data.updatedAt),
		createdAt: serializeDate(data.createdAt),
	};
}

/** Returns protected message records sorted by the most recent update. */
export async function getMessageRecords(): Promise<MessageRecord[]> {
	const admin = await getAdminUserFromCookies();
	if (!admin) throw new Error("Unauthorized");

	const documents = await fetchUpdatedApplicationMessages();
	return documents
		.map(buildMessageRecord)
		.filter((record): record is MessageRecord => record !== null)
		.sort((left, right) =>
			(right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""),
		);
}
