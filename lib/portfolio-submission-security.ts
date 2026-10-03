import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const PORTFOLIO_DOCUMENT_TYPES = [
	"portfolio",
	"businessPlan",
	"csrReport",
] as const;

export type PortfolioDocumentType = (typeof PORTFOLIO_DOCUMENT_TYPES)[number];

const TOKEN_LIFETIME_SECONDS = 10 * 60;

type VerificationTokenPayload = {
	applicationId: string;
	expiresAt: number;
};

function getVerificationSecret() {
	const secret = process.env.PORTFOLIO_VERIFICATION_SECRET;
	if (!secret) {
		throw new Error("Missing PORTFOLIO_VERIFICATION_SECRET");
	}

	return secret;
}

function sign(payload: string) {
	return createHmac("sha256", getVerificationSecret())
		.update(payload)
		.digest("base64url");
}

export function createVerificationToken(applicationId: string) {
	const payload: VerificationTokenPayload = {
		applicationId,
		expiresAt: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS,
	};
	const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
		"base64url",
	);

	return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyVerificationToken(token: string): string | null {
	const [encodedPayload, signature, ...remainder] = token.split(".");
	if (!encodedPayload || !signature || remainder.length > 0) return null;

	const expectedSignature = sign(encodedPayload);
	const actual = Buffer.from(signature);
	const expected = Buffer.from(expectedSignature);
	if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
		return null;
	}

	try {
		const payload = JSON.parse(
			Buffer.from(encodedPayload, "base64url").toString("utf8"),
		) as Partial<VerificationTokenPayload>;
		if (
			typeof payload.applicationId !== "string" ||
			typeof payload.expiresAt !== "number" ||
			payload.expiresAt < Math.floor(Date.now() / 1000)
		) {
			return null;
		}

		return payload.applicationId;
	} catch {
		return null;
	}
}

export function getRequiredDocuments(selectedAwards: string[]) {
	const requiredDocuments: PortfolioDocumentType[] = ["portfolio"];
	if (selectedAwards.includes("best-young-entrepreneur")) {
		requiredDocuments.push("businessPlan");
	}
	if (selectedAwards.includes("best-csr")) {
		requiredDocuments.push("csrReport");
	}

	return requiredDocuments;
}

export function isPortfolioDocumentType(
	value: string,
): value is PortfolioDocumentType {
	return PORTFOLIO_DOCUMENT_TYPES.includes(value as PortfolioDocumentType);
}
