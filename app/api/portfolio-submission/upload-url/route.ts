import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase-admin";
import {
	getRequiredDocuments,
	isPortfolioDocumentType,
	verifyVerificationToken,
} from "@/lib/portfolio-submission-security";
import { createTigrisObjectKey, createUploadUrl } from "@/lib/tigris-storage";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const uploadUrlSchema = z.object({
	contentType: z.literal("application/pdf"),
	documentType: z.string(),
	fileName: z.string().min(1).max(255),
	sizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
	verificationToken: z.string().min(1),
});

function asRecord(value: unknown): Record<string, unknown> {
	return value !== null && typeof value === "object"
		? (value as Record<string, unknown>)
		: {};
}

function asStringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

export async function POST(request: Request) {
	try {
		const parsed = uploadUrlSchema.safeParse(await request.json());
		if (!parsed.success || !isPortfolioDocumentType(parsed.data.documentType)) {
			return NextResponse.json(
				{ error: "Invalid upload request." },
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

		const application = await getAdminDb()
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
		const selectedAwards = asStringArray(
			asRecord(applicationData.awardSelection).selectedAwards,
		);
		const requiredDocuments = getRequiredDocuments(selectedAwards);
		if (!requiredDocuments.includes(parsed.data.documentType)) {
			return NextResponse.json(
				{ error: "This document is not required for your selected awards." },
				{ status: 403 },
			);
		}

		const applicantName = asRecord(
			applicationData.personalInfo,
		).publicDisplayName;
		const objectKey = createTigrisObjectKey(
			applicationId,
			typeof applicantName === "string" ? applicantName : undefined,
			parsed.data.documentType,
		);
		const uploadUrl = await createUploadUrl({ objectKey });

		return NextResponse.json({ objectKey, uploadUrl });
	} catch (error) {
		console.error("[Portfolio upload URL] Failed to create upload URL:", error);
		return NextResponse.json(
			{ error: "Could not prepare your upload. Please try again." },
			{ status: 500 },
		);
	}
}
