import type { AwardType } from "@/lib/awards";

export type BulkImportItem = {
	id: string;
	applicationId: string;
	applicantType: "internal" | "external";
	personalInfo: {
		publicDisplayName: string;
		email: string;
		nic?: string;
		gender?: string;
		whatsappNumber?: string;
		mobileNumber?: string;
	};
	academicInfo: {
		university?: string;
		universityRegistrationNumber?: string;
		universityEmail?: string;
		academicYear?: string;
		faculty?: string;
		degree?: string;
	};
	awardSelection?: {
		selectedAwards?: string[];
	};
};

export type BulkImportResultItem = {
	applicationId: string;
	registrationNumber: string;
	recipientName: string;
	recipientEmail: string;
	status: "created" | "failed" | "sent" | "send_failed";
	message: string;
};

export type BulkImportResult = {
	total: number;
	created: number;
	failed: number;
	sent: number;
	sendFailed: number;
	results: BulkImportResultItem[];
};

/** Validates the JSON structure of a bulk import item. */
export function validateBulkImportJson(data: unknown): {
	valid: boolean;
	items: BulkImportItem[];
	error?: string;
} {
	if (!Array.isArray(data)) {
		return { valid: false, items: [], error: "JSON must be an array." };
	}
	if (data.length === 0) {
		return { valid: false, items: [], error: "JSON array is empty." };
	}
	const items: BulkImportItem[] = [];
	for (let i = 0; i < data.length; i++) {
		const entry = data[i];
		if (!entry || typeof entry !== "object") {
			return {
				valid: false,
				items: [],
				error: `Item ${i + 1}: Not an object.`,
			};
		}
		const obj = entry as Record<string, unknown>;
		const personalInfo = obj.personalInfo as
			| Record<string, unknown>
			| undefined;
		if (!personalInfo?.email || !personalInfo?.publicDisplayName) {
			return {
				valid: false,
				items: [],
				error: `Item ${i + 1}: Missing personalInfo.email or personalInfo.publicDisplayName.`,
			};
		}
		items.push({
			id: (obj.id as string) || (obj.applicationId as string) || `import-${i}`,
			applicationId:
				(obj.applicationId as string) || (obj.id as string) || `import-${i}`,
			applicantType:
				(obj.applicantType as "internal" | "external") || "internal",
			personalInfo: {
				publicDisplayName: personalInfo.publicDisplayName as string,
				email: personalInfo.email as string,
				nic: personalInfo.nic as string | undefined,
				gender: personalInfo.gender as string | undefined,
				whatsappNumber: personalInfo.whatsappNumber as string | undefined,
				mobileNumber: personalInfo.mobileNumber as string | undefined,
			},
			academicInfo: {
				university: (obj.academicInfo as Record<string, unknown>)?.university as
					| string
					| undefined,
				universityRegistrationNumber: (
					obj.academicInfo as Record<string, unknown>
				)?.universityRegistrationNumber as string | undefined,
				faculty: (obj.academicInfo as Record<string, unknown>)?.faculty as
					| string
					| undefined,
				degree: (obj.academicInfo as Record<string, unknown>)?.degree as
					| string
					| undefined,
			},
			awardSelection: obj.awardSelection as BulkImportItem["awardSelection"],
		});
	}
	return { valid: true, items };
}

/** Resolves the award code from faculty string. */
export function resolveAwardCodeFromFaculty(faculty: string): AwardType | null {
	const upper = faculty.toUpperCase();
	const map: Record<string, AwardType> = {
		FHSS: "besa-fhss",
		FAS: "besa-fas",
		FMSC: "besa-fmsc",
		FMS: "besa-fms",
		FOT: "besa-fot",
		FOE: "besa-foe",
		FAHS: "besa-fahs",
		FUAB: "besa-fuab",
		FDS: "besa-fds",
		FOC: "besa-foc",
	};
	return map[upper] || null;
}
