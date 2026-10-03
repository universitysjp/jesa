import {
	type DocumentData,
	type DocumentSnapshot,
	FieldValue,
} from "firebase-admin/firestore";
import { WHATSAPP_LINKS } from "@/constants/whatsapp-links";
import type { AwardType } from "@/lib/awards";
import { getAdminDb } from "@/lib/firebase-admin";
import type {
	GeneratedAwardRegistration,
	RegistrationActionResult,
	RegistrationSourceApplication,
} from "../types";

// Each award owns an independent, permanent registration sequence.
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

type ExistingAwardRegistration = Partial<GeneratedAwardRegistration> & {
	awardCode?: unknown;
};

const REGISTRATION_YEAR = 2026;

/** Formats an application reference such as J26-APP-0002. */
function formatApplicationReference(year: number, sequence: number) {
	return `J${String(year).slice(-2)}-${String(sequence).padStart(4, "0")}`;
}

/** Formats an award registration such as FMS002, BTP002, or IU169. */
function formatAwardRegistration(awardCode: AwardType, sequence: number) {
	return `${AWARD_PREFIXES[awardCode]}${String(sequence).padStart(3, "0")}`;
}

/** Checks whether a value is a positive integer sequence. */
function isPositiveInteger(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Checks whether an application award is supported by the prefix map. */
function isAwardCode(value: string): value is AwardType {
	return value in AWARD_PREFIXES;
}

/** Validates selected awards and removes duplicate award codes. */
function normalizeSelectedAwards(selectedAwards: string[]) {
	const uniqueAwards = [...new Set(selectedAwards)];
	const invalidAwards = uniqueAwards.filter(
		(awardCode) => !isAwardCode(awardCode),
	);
	if (invalidAwards.length > 0) {
		throw new Error(`Unknown awards: ${invalidAwards.join(", ")}`);
	}
	const validAwards = uniqueAwards.filter(isAwardCode);
	if (validAwards.length < 1 || validAwards.length > 3) {
		throw new Error(
			"An application must contain between one and three awards.",
		);
	}
	return validAwards;
}

/** Reads the latest sequence from a counter, defaulting a missing counter to zero. */
function readLastCounterSequence(snapshot: DocumentSnapshot<DocumentData>) {
	if (!snapshot.exists) return 0;
	const value = snapshot.data()?.lastSequence;
	if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
		throw new Error(`Invalid counter: ${snapshot.ref.path}`);
	}
	return value;
}

/** Extracts a valid sequence from an application reference. */
function parseApplicationReference(value: unknown, year: number) {
	if (typeof value !== "string") return null;
	const shortYear = String(year).slice(-2);
	const match = value.match(new RegExp(`^J${shortYear}-APP-(\\d{4,})$`));
	if (!match) return null;
	const sequence = Number(match[1]);
	return isPositiveInteger(sequence) ? sequence : null;
}

/** Extracts a valid sequence from an award registration number. */
function parseAwardRegistrationNumber(awardCode: AwardType, value: unknown) {
	if (typeof value !== "string") return null;
	const match = value.match(
		new RegExp(`^${AWARD_PREFIXES[awardCode]}(\\d{3,})$`),
	);
	if (!match) return null;
	const sequence = Number(match[1]);
	return isPositiveInteger(sequence) ? sequence : null;
}

/** Validates and returns an existing award registration without changing its number. */
function getExistingAwardRegistration(
	existingRegistrations: ExistingAwardRegistration[],
	awardCode: AwardType,
): GeneratedAwardRegistration | null {
	const existing = existingRegistrations.find(
		(registration) => registration.awardCode === awardCode,
	);
	if (!existing) return null;

	const sequenceFromNumber = parseAwardRegistrationNumber(
		awardCode,
		existing.registrationNumber,
	);
	const storedSequence = isPositiveInteger(existing.registrationSequence)
		? existing.registrationSequence
		: null;
	if (
		sequenceFromNumber &&
		storedSequence &&
		sequenceFromNumber !== storedSequence
	) {
		throw new Error(
			`Registration number and sequence do not match for ${awardCode}.`,
		);
	}
	const registrationSequence = storedSequence ?? sequenceFromNumber;
	if (!registrationSequence) return null;
	const whatsapp = WHATSAPP_LINKS[awardCode];
	if (!whatsapp) {
		throw new Error(`WhatsApp configuration not found for ${awardCode}.`);
	}

	return {
		awardCode,
		awardLabel: whatsapp.label,
		registrationNumber: formatAwardRegistration(
			awardCode,
			registrationSequence,
		),
		registrationSequence,
		whatsappUrl: whatsapp.url,
		status: "active",
	};
}

/** Preserves registrations for awards that are no longer selected as removed history. */
function getRemovedAwardRegistrations(
	existingRegistrations: ExistingAwardRegistration[],
	selectedAwards: Set<AwardType>,
) {
	const removed = new Map<AwardType, GeneratedAwardRegistration>();
	for (const existing of existingRegistrations) {
		if (
			typeof existing.awardCode !== "string" ||
			!isAwardCode(existing.awardCode) ||
			selectedAwards.has(existing.awardCode)
		) {
			continue;
		}
		const registration = getExistingAwardRegistration(
			existingRegistrations,
			existing.awardCode,
		);
		if (registration) {
			removed.set(existing.awardCode, { ...registration, status: "removed" });
		}
	}
	return [...removed.values()];
}

/** Determines whether existing active/removed flags differ from current selections. */
function hasAwardStatusChanges(
	existingRegistrations: ExistingAwardRegistration[],
	selectedAwards: Set<AwardType>,
) {
	return existingRegistrations.some((registration) => {
		if (
			typeof registration.awardCode !== "string" ||
			!isAwardCode(registration.awardCode)
		) {
			return false;
		}
		const shouldBeActive = selectedAwards.has(registration.awardCode);
		return shouldBeActive
			? registration.status === "removed"
			: registration.status !== "removed";
	});
}

/** Creates or completes one updatedApplications registration in a transaction. */
export async function registerSingleApplication(
	application: RegistrationSourceApplication,
): Promise<RegistrationActionResult> {
	const db = getAdminDb();
	const selectedAwards = normalizeSelectedAwards(
		application.awardSelection.selectedAwards,
	);
	const selectedAwardSet = new Set(selectedAwards);
	const updatedApplicationReference = db
		.collection("updatedApplications")
		.doc(application.applicationId);
	const applicationCounterReference = db
		.collection("registrationCounters")
		.doc(`application-${REGISTRATION_YEAR}`);

	return db.runTransaction(async (transaction) => {
		const existingSnapshot = await transaction.get(updatedApplicationReference);
		const existingData = existingSnapshot.exists
			? existingSnapshot.data()
			: null;
		const existingAwardRegistrations = Array.isArray(
			existingData?.awardRegistrations,
		)
			? (existingData.awardRegistrations as ExistingAwardRegistration[])
			: [];
		const sequenceFromReference = parseApplicationReference(
			existingData?.applicationReferenceNumber,
			REGISTRATION_YEAR,
		);
		const storedApplicationSequence = isPositiveInteger(
			existingData?.applicationSequence,
		)
			? existingData.applicationSequence
			: null;
		if (
			sequenceFromReference &&
			storedApplicationSequence &&
			sequenceFromReference !== storedApplicationSequence
		) {
			throw new Error("Application reference and sequence do not match.");
		}

		let applicationSequence =
			storedApplicationSequence ?? sequenceFromReference;
		let applicationReferenceNumber = applicationSequence
			? formatApplicationReference(REGISTRATION_YEAR, applicationSequence)
			: null;
		const awardRegistrations = new Map<AwardType, GeneratedAwardRegistration>();
		const missingAwardCodes: AwardType[] = [];
		for (const awardCode of selectedAwards) {
			const existing = getExistingAwardRegistration(
				existingAwardRegistrations,
				awardCode,
			);
			if (existing) awardRegistrations.set(awardCode, existing);
			else missingAwardCodes.push(awardCode);
		}

		const needsApplicationSequence = applicationSequence === null;
		const statusChanges = hasAwardStatusChanges(
			existingAwardRegistrations,
			selectedAwardSet,
		);
		if (
			!needsApplicationSequence &&
			missingAwardCodes.length === 0 &&
			!statusChanges
		) {
			return {
				applicationId: application.applicationId,
				applicationReferenceNumber,
				status: "skipped",
				message: "All required registration numbers already exist.",
				awardRegistrations: selectedAwards.map(
					(awardCode) => awardRegistrations.get(awardCode)!,
				),
			};
		}

		const awardCounterReferences = missingAwardCodes.map((awardCode) =>
			db
				.collection("registrationCounters")
				.doc(`award-${REGISTRATION_YEAR}-${awardCode}`),
		);
		// All counter reads finish before the first transaction write.
		const applicationCounterSnapshot = needsApplicationSequence
			? await transaction.get(applicationCounterReference)
			: null;
		const awardCounterSnapshots = await Promise.all(
			awardCounterReferences.map((reference) => transaction.get(reference)),
		);

		if (needsApplicationSequence && applicationCounterSnapshot) {
			applicationSequence =
				readLastCounterSequence(applicationCounterSnapshot) + 1;
			applicationReferenceNumber = formatApplicationReference(
				REGISTRATION_YEAR,
				applicationSequence,
			);
		}
		missingAwardCodes.forEach((awardCode, index) => {
			const sequence =
				readLastCounterSequence(awardCounterSnapshots[index]) + 1;
			const whatsapp = WHATSAPP_LINKS[awardCode];
			if (!whatsapp) {
				throw new Error(`WhatsApp configuration not found for ${awardCode}.`);
			}
			awardRegistrations.set(awardCode, {
				awardCode,
				awardLabel: whatsapp.label,
				registrationNumber: formatAwardRegistration(awardCode, sequence),
				registrationSequence: sequence,
				whatsappUrl: whatsapp.url,
				status: "active",
			});
		});

		if (needsApplicationSequence) {
			transaction.set(
				applicationCounterReference,
				{
					type: "application",
					year: REGISTRATION_YEAR,
					lastSequence: applicationSequence,
					updatedAt: FieldValue.serverTimestamp(),
				},
				{ merge: true },
			);
		}
		missingAwardCodes.forEach((awardCode, index) => {
			const registration = awardRegistrations.get(awardCode)!;
			transaction.set(
				awardCounterReferences[index],
				{
					type: "award",
					year: REGISTRATION_YEAR,
					awardCode,
					prefix: AWARD_PREFIXES[awardCode],
					lastSequence: registration.registrationSequence,
					updatedAt: FieldValue.serverTimestamp(),
				},
				{ merge: true },
			);
		});

		const activeAwardRegistrations = selectedAwards.map((awardCode) => {
			const registration = awardRegistrations.get(awardCode);
			if (!registration) {
				throw new Error(`Registration could not be created for ${awardCode}.`);
			}
			return registration;
		});
		const removedAwardRegistrations = getRemovedAwardRegistrations(
			existingAwardRegistrations,
			selectedAwardSet,
		);
		const now = FieldValue.serverTimestamp();
		const registrationDocument: Record<string, unknown> = {
			applicationId: application.applicationId,
			applicationReferenceNumber,
			applicationSequence,
			registrationYear: REGISTRATION_YEAR,
			applicantType: application.applicantType,
			recipient: {
				name: application.personalInfo.publicDisplayName,
				email: application.personalInfo.email,
			},
			awardRegistrations: [
				...activeAwardRegistrations,
				...removedAwardRegistrations,
			],
			registrationStatus: "generated",
			registrationGeneratedAt: existingData?.registrationGeneratedAt ?? now,
			emailDispatch: existingData?.emailDispatch ?? {
				status: "not_sent",
				latestResendEmailId: null,
				sendCount: 0,
				firstSentAt: null,
				lastSentAt: null,
				deliveredAt: null,
				bouncedAt: null,
				lastError: null,
			},
			updatedAt: now,
		};
		if (!existingSnapshot.exists) registrationDocument.createdAt = now;
		transaction.set(updatedApplicationReference, registrationDocument, {
			merge: true,
		});

		return {
			applicationId: application.applicationId,
			applicationReferenceNumber,
			status: existingSnapshot.exists ? "updated" : "created",
			message: existingSnapshot.exists
				? "Missing registration numbers were added."
				: "Registration record created successfully.",
			awardRegistrations: activeAwardRegistrations,
		};
	});
}
