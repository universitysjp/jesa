import { NextResponse } from "next/server";
import { getAdminUserFromRequest } from "@/app/admin/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RecordValue = Record<string, unknown>;

function asRecord(value: unknown): RecordValue {
	return value !== null && typeof value === "object"
		? (value as RecordValue)
		: {};
}

function asString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function asStringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

function toIsoDate(value: unknown): string | null {
	const maybeTimestamp = asRecord(value);
	if (typeof maybeTimestamp._seconds === "number") {
		return new Date(maybeTimestamp._seconds * 1000).toISOString();
	}
	if (value instanceof Date) return value.toISOString();
	if (value && typeof (value as { toDate?: unknown }).toDate === "function") {
		return (value as { toDate: () => Date }).toDate().toISOString();
	}
	return null;
}

function mapDocument(value: unknown) {
	const data = asRecord(value);
	if (!Object.keys(data).length) return null;

	return {
		bucket: asString(data.bucket),
		contentType: asString(data.contentType),
		objectPath: asString(data.objectPath),
		originalFileName: asString(data.originalFileName),
		sizeBytes: typeof data.sizeBytes === "number" ? data.sizeBytes : undefined,
		status: asString(data.status),
		uploadedAt: toIsoDate(data.uploadedAt),
		updatedAt: toIsoDate(data.updatedAt),
	};
}

export async function GET(request: Request) {
	try {
		const user = await getAdminUserFromRequest(request);
		if (!user)
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

		const db = getAdminDb();
		const submissionsSnapshot = await db
			.collection("portfolioSubmissions")
			.get();
		const submissions = await Promise.all(
			submissionsSnapshot.docs.map(async (submissionDoc) => {
				const submissionData = asRecord(submissionDoc.data());
				const applicationId =
					asString(submissionData.applicationId) ?? submissionDoc.id;
				const [applicationDoc, registrationSnapshot] = await Promise.all([
					db.collection("applications").doc(applicationId).get(),
					db
						.collection("updatedApplications")
						.where("applicationId", "==", applicationId)
						.limit(1)
						.get(),
				]);

				const applicationData = asRecord(applicationDoc.data());
				const personalInfo = asRecord(applicationData.personalInfo);
				const academicInfo = asRecord(applicationData.academicInfo);
				const awardSelection = asRecord(applicationData.awardSelection);
				const registrationData = asRecord(registrationSnapshot.docs[0]?.data());
				const awardRegistrations = Array.isArray(
					registrationData.awardRegistrations,
				)
					? registrationData.awardRegistrations.map((item) => {
							const registration = asRecord(item);
							return {
								awardCode: asString(registration.awardCode),
								awardLabel: asString(registration.awardLabel),
								registrationNumber: asString(registration.registrationNumber),
								status: asString(registration.status),
							};
						})
					: [];

				return {
					academic: {
						academicYear: asString(academicInfo.academicYear),
						degree: asString(academicInfo.degree),
						faculty: asString(academicInfo.faculty),
						university: asString(academicInfo.university),
						universityEmail: asString(academicInfo.universityEmail),
						universityRegistrationNumber: asString(
							academicInfo.universityRegistrationNumber,
						),
					},
					applicant: {
						email: asString(personalInfo.email),
						mobileNumber: asString(personalInfo.mobileNumber),
						name: asString(personalInfo.publicDisplayName),
						// Prefer the stored snapshot, but fall back to the application so
						// records written before the NIC was persisted still resolve.
						nic:
							asString(asRecord(submissionData.applicant).nic) ??
							asString(personalInfo.nic),
					},
					applicationId,
					applicationReferenceNumber: asString(
						registrationData.applicationReferenceNumber,
					),
					awardRegistrations,
					createdAt: toIsoDate(submissionData.createdAt),
					documents: {
						businessPlan: mapDocument(submissionData.businessPlan),
						csrReport: mapDocument(submissionData.csrReport),
						portfolio: mapDocument(submissionData.portfolio),
					},
					requiredDocuments: asStringArray(submissionData.requiredDocuments),
					selectedAwards: asStringArray(awardSelection.selectedAwards).length
						? asStringArray(awardSelection.selectedAwards)
						: asStringArray(submissionData.selectedAwards),
					submissionStatus:
						asString(submissionData.submissionStatus) ?? "incomplete",
					updatedAt: toIsoDate(submissionData.updatedAt),
				};
			}),
		);

		return NextResponse.json({ submissions });
	} catch (error) {
		console.error("[Admin submissions] Failed to fetch submissions:", error);
		return NextResponse.json(
			{ error: "Failed to fetch portfolio submissions" },
			{ status: 500 },
		);
	}
}
