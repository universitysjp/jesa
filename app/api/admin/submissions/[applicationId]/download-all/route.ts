import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { getAdminUserFromRequest } from "@/app/admin/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import {
	PORTFOLIO_DOCUMENT_TYPES,
	type PortfolioDocumentType,
} from "@/lib/portfolio-submission-security";
import { createObjectBodyStream } from "@/lib/tigris-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DOCUMENT_LABELS: Record<PortfolioDocumentType, string> = {
	businessPlan: "Business Plan",
	csrReport: "CSR Report",
	portfolio: "Portfolio",
};

function asRecord(value: unknown): Record<string, unknown> {
	return value !== null && typeof value === "object"
		? (value as Record<string, unknown>)
		: {};
}

function slugifyFileName(value: string) {
	return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ applicationId: string }> },
) {
	const user = await getAdminUserFromRequest(request);
	if (!user) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { applicationId } = await params;
	const submission = await getAdminDb()
		.collection("portfolioSubmissions")
		.doc(applicationId)
		.get();

	if (!submission.exists) {
		return Response.json({ error: "Submission not found" }, { status: 404 });
	}

	const submissionData = asRecord(submission.data());
	const applicationSnapshot = await getAdminDb()
		.collection("applications")
		.doc(applicationId)
		.get();
	const nic = asRecord(asRecord(applicationSnapshot.data()).personalInfo).nic;
	const uploadedDocuments = PORTFOLIO_DOCUMENT_TYPES.flatMap((documentType) => {
		const file = asRecord(submissionData[documentType]);
		const objectPath = file.objectPath;

		return typeof objectPath === "string" && objectPath.length > 0
			? [{ documentType, objectPath }]
			: [];
	});

	if (uploadedDocuments.length === 0) {
		return Response.json(
			{ error: "No submitted documents are available to download" },
			{ status: 404 },
		);
	}

	const archive = new ZipArchive({ zlib: { level: 9 } });

	for (const { documentType, objectPath } of uploadedDocuments) {
		try {
			// Streamed entry-by-entry so multi-file archives never buffer fully.
			const body = await createObjectBodyStream(objectPath);
			archive.append(body, { name: `${DOCUMENT_LABELS[documentType]}.pdf` });
		} catch (error) {
			console.error(
				`[Admin submissions] Failed to read ${documentType}:`,
				error,
			);
			archive.destroy();
			return Response.json(
				{ error: "Could not read one of the submitted documents" },
				{ status: 502 },
			);
		}
	}

	void archive.finalize().catch((error: unknown) => {
		console.error("[Admin submissions] Failed to build archive:", error);
		archive.destroy();
	});

	// Admins identify applicants by NIC, so name the archive accordingly and
	// fall back to the application ID if the NIC is missing.
	const fileName = `${slugifyFileName(
		typeof nic === "string" && nic.length > 0 ? nic : applicationId,
	)}.zip`;

	return new Response(
		Readable.toWeb(archive as unknown as Readable) as unknown as ReadableStream,
		{
			headers: {
				"Cache-Control": "no-store",
				"Content-Disposition": `attachment; filename="${fileName}"`,
				"Content-Type": "application/zip",
				"X-Content-Type-Options": "nosniff",
			},
		},
	);
}
