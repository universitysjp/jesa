import type { PortfolioDocumentType } from "@/lib/portfolio-submission-security";

/**
 * Object naming for portfolio documents.
 *
 * This module is intentionally free of `server-only` and any storage client so
 * the naming rules stay pure and unit testable.
 */

const NIC_PATTERN = /^[0-9]{9}[vVxX]$|^[0-9]{12}$/;

const DOCUMENT_FILE_NAMES: Record<PortfolioDocumentType, string> = {
	businessPlan: "business-plan",
	csrReport: "csr-report",
	portfolio: "portfolio",
};

export function slugifyApplicantName(name: string | undefined) {
	const slug = (name ?? "applicant")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return slug || "applicant";
}

/**
 * Normalizes a stored NIC into a safe path segment.
 *
 * The NIC is stored as the applicant typed it, so it can be lowercase. Both the
 * upload-URL and completion routes must derive the same object key, otherwise
 * completion rejects its own upload. Normalizing here keeps that deterministic.
 *
 * Returns `null` for anything that is not a recognised NIC shape so unexpected
 * values never reach an object path.
 */
export function normalizeNicSegment(nic: string | undefined | null) {
	if (typeof nic !== "string") return null;

	const normalized = nic.trim().toUpperCase();
	return NIC_PATTERN.test(normalized) ? normalized : null;
}

export function createPortfolioFileName({
	applicantName,
	documentType,
	nic,
}: {
	applicantName: string | undefined;
	documentType: PortfolioDocumentType;
	nic: string | undefined | null;
}) {
	const nameSegment = slugifyApplicantName(applicantName);
	const documentSegment = DOCUMENT_FILE_NAMES[documentType];
	const nicSegment = normalizeNicSegment(nic);

	return nicSegment
		? `${nameSegment}-${nicSegment}-${documentSegment}.pdf`
		: `${nameSegment}-${documentSegment}.pdf`;
}

export function createPortfolioObjectKey({
	applicantName,
	applicationId,
	documentType,
	nic,
	registrationYear,
}: {
	applicantName: string | undefined;
	applicationId: string;
	documentType: PortfolioDocumentType;
	nic: string | undefined | null;
	registrationYear: number | string;
}) {
	return `${registrationYear}/${applicationId}/${createPortfolioFileName({
		applicantName,
		documentType,
		nic,
	})}`;
}
