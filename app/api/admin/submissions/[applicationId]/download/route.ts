import { NextResponse } from "next/server";
import { getAdminUserFromRequest } from "@/app/admin/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isPortfolioDocumentType } from "@/lib/portfolio-submission-security";
import { createDownloadUrl } from "@/lib/tigris-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function asRecord(value: unknown): Record<string, unknown> {
	return value !== null && typeof value === "object"
		? (value as Record<string, unknown>)
		: {};
}

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ applicationId: string }> },
) {
	try {
		const user = await getAdminUserFromRequest(request);
		if (!user)
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

		const { applicationId } = await params;
		const documentType = new URL(request.url).searchParams.get("documentType");
		if (!documentType || !isPortfolioDocumentType(documentType)) {
			return NextResponse.json(
				{ error: "Invalid document type" },
				{ status: 400 },
			);
		}

		const submission = await getAdminDb()
			.collection("portfolioSubmissions")
			.doc(applicationId)
			.get();
		if (!submission.exists) {
			return NextResponse.json(
				{ error: "Submission not found" },
				{ status: 404 },
			);
		}

		const fileData = asRecord(asRecord(submission.data())[documentType]);
		const objectPath = fileData.objectPath;
		if (typeof objectPath !== "string") {
			return NextResponse.json({ error: "File not found" }, { status: 404 });
		}

		return NextResponse.json({ url: await createDownloadUrl(objectPath) });
	} catch (error) {
		console.error("[Admin submissions] Failed to create download URL:", error);
		return NextResponse.json(
			{ error: "Failed to open submitted document" },
			{ status: 500 },
		);
	}
}
