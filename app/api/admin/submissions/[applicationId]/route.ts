import { NextResponse } from "next/server";
import { logAdminAction } from "@/app/admin/lib/audit";
import { getAdminUserFromRequest } from "@/app/admin/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { PORTFOLIO_DOCUMENT_TYPES } from "@/lib/portfolio-submission-security";
import { deleteTigrisObject } from "@/lib/tigris-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function asRecord(value: unknown): Record<string, unknown> {
	return value !== null && typeof value === "object"
		? (value as Record<string, unknown>)
		: {};
}

function asString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ applicationId: string }> },
) {
	try {
		const user = await getAdminUserFromRequest(request);
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { applicationId } = await params;
		const db = getAdminDb();
		const submissionRef = db
			.collection("portfolioSubmissions")
			.doc(applicationId);
		const submission = await submissionRef.get();

		if (!submission.exists) {
			return NextResponse.json(
				{ error: "Submission not found" },
				{ status: 404 },
			);
		}

		const submissionData = asRecord(submission.data());
		const applicant = asRecord(submissionData.applicant);
		const documentTypesWithFiles = PORTFOLIO_DOCUMENT_TYPES.filter(
			(documentType) =>
				asString(asRecord(submissionData[documentType]).objectPath) !==
				undefined,
		);
		const objectPaths = documentTypesWithFiles.flatMap((documentType) => {
			const objectPath = asString(
				asRecord(submissionData[documentType]).objectPath,
			);
			return objectPath ? [objectPath] : [];
		});

		// Metadata is removed first on purpose. If Tigris cleanup then fails we are
		// left with an orphaned object, which is recoverable. The reverse order
		// would leave stored metadata pointing at a file that no longer exists, so
		// the admin UI would advertise an uploaded document that returns 404.
		await submissionRef.delete();

		const cleanupFailures: string[] = [];
		for (const objectPath of objectPaths) {
			try {
				await deleteTigrisObject(objectPath);
			} catch (error) {
				console.error(
					"[Admin submissions] Failed to delete stored object:",
					objectPath,
					error,
				);
				cleanupFailures.push(objectPath);
			}
		}

		await logAdminAction("delete_portfolio_submission", user, request, {
			targetId: applicationId,
			targetEmail: asString(applicant.email),
			details: {
				deletedFileCount: objectPaths.length,
				documentTypes: documentTypesWithFiles,
				orphanCleanupFailures: cleanupFailures.length,
				applicantName: asString(applicant.name),
				nic: asString(applicant.nic),
				submissionStatus: asString(submissionData.submissionStatus),
			},
		});

		return NextResponse.json({
			success: true,
			deletedFileCount: objectPaths.length,
			orphanCleanupFailures: cleanupFailures.length,
		});
	} catch (error) {
		console.error("[Admin submissions] Failed to delete submission:", error);
		return NextResponse.json(
			{ error: "Failed to delete submission" },
			{ status: 500 },
		);
	}
}
