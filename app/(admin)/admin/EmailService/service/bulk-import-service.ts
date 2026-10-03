"use server";

import { Resend } from "resend";
import { WHATSAPP_LINKS } from "@/constants/whatsapp-links";
import { type AwardType, BESA_FACULTY_MAP } from "@/lib/awards";
import { getAdminDb } from "@/lib/firebase-admin";
import RegistrationEmail from "../registration-email";
import type {
	BulkImportItem,
	BulkImportResult,
	BulkImportResultItem,
} from "./bulk-import-types";

const resend = new Resend(process.env.NEXT_RESEND_API_KEY);
const REGISTRATION_YEAR = 2026;

const AWARD_PREFIXES: Record<AwardType, string> = {
	"best-leader": "BL",
	"best-team-player": "BTP",
	"best-creative-designer": "BCD",
	"best-communicator": "BCOM",
	"best-innovator": "BI",
	"best-young-entrepreneur": "BYE",
	"best-csr": "CSR",
	"besa-inter-university": "IU",
	"besa-fhss": "FHSS",
	"besa-fas": "FAS",
	"besa-fmsc": "FMSC",
	"besa-fms": "FMS",
	"besa-fot": "FOT",
	"besa-foe": "FOE",
	"besa-fahs": "FAHS",
	"besa-fuab": "FUAB",
	"besa-fds": "FDS",
	"besa-foc": "FOC",
};

function readLastCounterSequence(
	data: Record<string, unknown> | undefined,
): number {
	if (!data) return 0;
	const value = data.lastSequence;
	if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
		return 0;
	}
	return value;
}

function formatApplicationReference(year: number, sequence: number): string {
	return `J${String(year).slice(-2)}-${String(sequence).padStart(4, "0")}`;
}

function formatAwardRegistration(awardCode: string, sequence: number): string {
	const prefix = AWARD_PREFIXES[awardCode as AwardType] || "UNK";
	return `${prefix}${String(sequence).padStart(3, "0")}`;
}

function resolveAwardCode(item: BulkImportItem): AwardType | null {
	if (
		item.awardSelection?.selectedAwards &&
		item.awardSelection.selectedAwards.length > 0
	) {
		const code = item.awardSelection.selectedAwards[0];
		if (code in AWARD_PREFIXES) return code as AwardType;
	}
	if (item.academicInfo.faculty) {
		const upper = item.academicInfo.faculty.toUpperCase();
		if (upper in BESA_FACULTY_MAP) return BESA_FACULTY_MAP[upper];
	}
	return null;
}

/** Processes bulk import: creates records in updatedApplications and sends emails. */
export async function processBulkImport(
	items: BulkImportItem[],
	options: { sendEmails: boolean } = { sendEmails: true },
): Promise<BulkImportResult> {
	const db = getAdminDb();
	const results: BulkImportResultItem[] = [];

	const appCounterRef = db
		.collection("registrationCounters")
		.doc(`application-${REGISTRATION_YEAR}`);
	const appCounterSnap = await appCounterRef.get();
	let currentAppSequence = readLastCounterSequence(appCounterSnap.data());

	for (const item of items) {
		try {
			const awardCode = resolveAwardCode(item);
			if (!awardCode) {
				results.push({
					applicationId: item.applicationId,
					registrationNumber: "",
					recipientName: item.personalInfo.publicDisplayName,
					recipientEmail: item.personalInfo.email,
					status: "failed",
					message: `No valid award found for faculty: ${item.academicInfo.faculty || "unknown"}.`,
				});
				continue;
			}

			currentAppSequence++;
			const applicationReferenceNumber = formatApplicationReference(
				REGISTRATION_YEAR,
				currentAppSequence,
			);

			const awardCounterRef = db
				.collection("registrationCounters")
				.doc(`award-${REGISTRATION_YEAR}-${awardCode}`);
			const awardCounterSnap = await awardCounterRef.get();
			const nextAwardSequence =
				readLastCounterSequence(awardCounterSnap.data()) + 1;
			const registrationNumber = formatAwardRegistration(
				awardCode,
				nextAwardSequence,
			);

			const whatsappEntry = WHATSAPP_LINKS[awardCode];
			const awardRegistration = {
				awardCode,
				awardLabel: whatsappEntry?.label || awardCode,
				label: whatsappEntry?.label || awardCode,
				registrationNumber,
				registrationSequence: nextAwardSequence,
				whatsappUrl: whatsappEntry?.url || "",
				status: "active" as const,
			};

			const now = new Date();
			const registrationDocument: Record<string, unknown> = {
				applicationId: item.applicationId,
				applicationReferenceNumber,
				applicationSequence: currentAppSequence,
				registrationYear: REGISTRATION_YEAR,
				applicantType: item.applicantType,
				recipient: {
					name: item.personalInfo.publicDisplayName,
					email: item.personalInfo.email,
				},
				awardRegistrations: [awardRegistration],
				registrationStatus: "generated",
				registrationGeneratedAt: now,
				emailDispatch: {
					status: "not_sent",
					latestResendEmailId: null,
					sendCount: 0,
					firstSentAt: null,
					lastSentAt: null,
					deliveredAt: null,
					bouncedAt: null,
					lastError: null,
				},
				createdAt: now,
				updatedAt: now,
			};

			const updatedAppRef = db
				.collection("updatedApplications")
				.doc(item.applicationId);
			await updatedAppRef.set(registrationDocument, { merge: true });

			await awardCounterRef.set(
				{
					type: "award",
					year: REGISTRATION_YEAR,
					awardCode,
					prefix: AWARD_PREFIXES[awardCode],
					lastSequence: nextAwardSequence,
					updatedAt: now,
				},
				{ merge: true },
			);

			let emailStatus: BulkImportResultItem["status"] = "created";
			let emailMessage = "Record created successfully.";

			if (options.sendEmails) {
				try {
					const html = RegistrationEmail({
						recipientName: item.personalInfo.publicDisplayName,
						applicationReferenceNumber,
						awards: [awardRegistration],
					});

					const { data, error } = await resend.emails.send({
						from:
							process.env.RESEND_FROM_EMAIL ??
							"JESA 2026 <onboarding@resend.dev>",
						to: [item.personalInfo.email],
						subject: `Registration Confirmed - ${applicationReferenceNumber}`,
						html,
					});

					if (error) {
						emailStatus = "send_failed";
						emailMessage = `Record created but email failed: ${error.message}`;
					} else {
						emailStatus = "sent";
						emailMessage = "Record created and email sent.";
						await updatedAppRef.update({
							"emailDispatch.status": "accepted",
							"emailDispatch.latestResendEmailId": data?.id || null,
							"emailDispatch.sendCount": 1,
							"emailDispatch.firstSentAt": now,
							"emailDispatch.lastSentAt": now,
						});
					}
				} catch (emailError) {
					emailStatus = "send_failed";
					emailMessage = `Record created but email failed: ${emailError instanceof Error ? emailError.message : "Unknown error"}`;
				}
			}

			results.push({
				applicationId: item.applicationId,
				registrationNumber: applicationReferenceNumber,
				recipientName: item.personalInfo.publicDisplayName,
				recipientEmail: item.personalInfo.email,
				status: emailStatus,
				message: emailMessage,
			});
		} catch (error) {
			results.push({
				applicationId: item.applicationId,
				registrationNumber: "",
				recipientName: item.personalInfo.publicDisplayName,
				recipientEmail: item.personalInfo.email,
				status: "failed",
				message: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	await appCounterRef.set(
		{
			type: "application",
			year: REGISTRATION_YEAR,
			lastSequence: currentAppSequence,
			updatedAt: new Date(),
		},
		{ merge: true },
	);

	return {
		total: results.length,
		created: results.filter((r) => r.status === "created").length,
		failed: results.filter((r) => r.status === "failed").length,
		sent: results.filter((r) => r.status === "sent").length,
		sendFailed: results.filter((r) => r.status === "send_failed").length,
		results,
	};
}
