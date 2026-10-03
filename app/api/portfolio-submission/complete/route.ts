import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase-admin";
import {
	getRequiredDocuments,
	isPortfolioDocumentType,
	type PortfolioDocumentType,
	verifyVerificationToken,
} from "@/lib/portfolio-submission-security";
import {
	createTigrisObjectKey,
	deleteTigrisObject,
	getTigrisBucketName,
	inspectPdfObject,
} from "@/lib/tigris-storage";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const completionSchema = z.object({
	documentType: z.string(),
	objectKey: z.string().min(1).max(1024),
	originalFileName: z.string().min(1).max(255),
	verificationToken: z.string().min(1),
});

function asRecord(value: unknown): Record<string, unknown> {
	return value !== null && typeof value === "object"
		? (value as Record<string, unknown>)
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

function omitUndefined<T extends Record<string, unknown>>(value: T) {
	return Object.fromEntries(
		Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
	);
}

function isAllowedDocument(
	documentType: PortfolioDocumentType,
	selectedAwards: string[],
) {
	return getRequiredDocuments(selectedAwards).includes(documentType);
}

export async function POST(request: Request) {
	try {
		const parsed = completionSchema.safeParse(await request.json());
		if (!parsed.success || !isPortfolioDocumentType(parsed.data.documentType)) {
			return NextResponse.json(
				{ error: "Invalid upload confirmation." },
				{ status: 400 },
			);
		}

		const applicationId = verifyVerificationToken(
			parsed.data.verificationToken,
		);
		if (!applicationId) {
			return NextResponse.json(
				{ error: "Your verification has expired. Verify your NIC again." },
				{ status: 401 },
			);
		}

		const db = getAdminDb();
		const application = await db
			.collection("applications")
			.doc(applicationId)
			.get();
		if (!application.exists) {
			return NextResponse.json(
				{ error: "Application not found." },
				{ status: 404 },
			);
		}

		const applicationData = asRecord(application.data());
		const personalInfo = asRecord(applicationData.personalInfo);
		const academicInfo = asRecord(applicationData.academicInfo);
		const selectedAwards = asStringArray(
			asRecord(applicationData.awardSelection).selectedAwards,
		);
		const applicantName = asString(personalInfo.publicDisplayName);

		if (!isAllowedDocument(parsed.data.documentType, selectedAwards)) {
			return NextResponse.json(
				{ error: "This document is not required for your selected awards." },
				{ status: 403 },
			);
		}

		const expectedObjectKey = createTigrisObjectKey(
			applicationId,
			applicantName,
			parsed.data.documentType,
		);
		if (parsed.data.objectKey !== expectedObjectKey) {
			return NextResponse.json(
				{ error: "Invalid upload location." },
				{ status: 400 },
			);
		}

		const uploadedFile = await inspectPdfObject(expectedObjectKey);
		const isValidPdf =
			uploadedFile.contentType?.startsWith("application/pdf") &&
			uploadedFile.hasPdfHeader &&
			typeof uploadedFile.sizeBytes === "number" &&
			uploadedFile.sizeBytes > 0 &&
			uploadedFile.sizeBytes <= MAX_FILE_SIZE_BYTES;

		if (!isValidPdf) {
			await deleteTigrisObject(expectedObjectKey);
			return NextResponse.json(
				{ error: "The uploaded file must be a PDF no larger than 20 MB." },
				{ status: 400 },
			);
		}

		const updatedApplications = await db
			.collection("updatedApplications")
			.where("applicationId", "==", applicationId)
			.limit(1)
			.get();
		const applicationReferenceNumber = asString(
			asRecord(updatedApplications.docs[0]?.data()).applicationReferenceNumber,
		);
		const requiredDocuments = getRequiredDocuments(selectedAwards);
		const submissionRef = db
			.collection("portfolioSubmissions")
			.doc(applicationId);
		const documentMetadata = {
			bucket: getTigrisBucketName(),
			contentType: "application/pdf",
			objectPath: expectedObjectKey,
			originalFileName: parsed.data.originalFileName,
			sizeBytes: uploadedFile.sizeBytes,
			status: "uploaded",
			storageProvider: "tigris",
			uploadedAt: FieldValue.serverTimestamp(),
			updatedAt: FieldValue.serverTimestamp(),
		};
		const applicant = omitUndefined({
			email: asString(personalInfo.email),
			faculty: asString(academicInfo.faculty),
			mobileNumber: asString(personalInfo.mobileNumber),
			name: applicantName,
			university: asString(academicInfo.university),
			universityRegistrationNumber: asString(
				academicInfo.universityRegistrationNumber,
			),
		});

		await db.runTransaction(async (transaction) => {
			const existingSubmission = await transaction.get(submissionRef);
			const existingData = asRecord(existingSubmission.data());
			const prospectiveSubmission = {
				...existingData,
				[parsed.data.documentType]: documentMetadata,
			};
			const isComplete = requiredDocuments.every(
				(documentType) =>
					asRecord(prospectiveSubmission[documentType]).status === "uploaded",
			);

			transaction.set(
				submissionRef,
				{
					applicationId,
					...(applicationReferenceNumber === undefined
						? {}
						: { applicationReferenceNumber }),
					applicant,
					[parsed.data.documentType]: documentMetadata,
					requiredDocuments,
					selectedAwards,
					submissionStatus: isComplete ? "submitted" : "incomplete",
					updatedAt: FieldValue.serverTimestamp(),
					...(existingSubmission.exists
						? {}
						: { createdAt: FieldValue.serverTimestamp() }),
				},
				{ merge: true },
			);
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error(
			"[Portfolio upload completion] Failed to complete upload:",
			error,
		);
		return NextResponse.json(
			{ error: "Could not confirm your upload. Please try again." },
			{ status: 500 },
		);
	}
}
