import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const nicSchema = z.object({
	nic: z
		.string()
		.trim()
		.regex(
			/^[0-9]{9}[vVxX]$|^[0-9]{12}$/,
			"Enter a valid NIC: 9 digits followed by V/X, or 12 digits.",
		)
		.transform((nic) => nic.toUpperCase()),
});

const attempts = new Map<string, number[]>();

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
	return value !== null && typeof value === "object"
		? (value as UnknownRecord)
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

function formatAwardCode(awardCode: string) {
	return awardCode
		.split("-")
		.map((part) =>
			part.toUpperCase() === "BESA"
				? part.toUpperCase()
				: `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
		)
		.join(" ");
}

function getClientIdentifier(request: Request) {
	return (
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
	);
}

function isRateLimited(clientIdentifier: string) {
	const now = Date.now();
	const recentAttempts = (attempts.get(clientIdentifier) ?? []).filter(
		(attemptedAt) => now - attemptedAt < RATE_LIMIT_WINDOW_MS,
	);

	if (recentAttempts.length >= MAX_ATTEMPTS) {
		attempts.set(clientIdentifier, recentAttempts);
		return true;
	}

	recentAttempts.push(now);
	attempts.set(clientIdentifier, recentAttempts);
	return false;
}

export async function POST(request: Request) {
	if (isRateLimited(getClientIdentifier(request))) {
		return NextResponse.json(
			{
				error:
					"Too many verification attempts. Please try again in 15 minutes.",
			},
			{ status: 429 },
		);
	}

	try {
		const body: unknown = await request.json();
		const parsed = nicSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json(
				{ error: parsed.error.issues[0]?.message ?? "Invalid NIC." },
				{ status: 400 },
			);
		}

		const db = getAdminDb();
		const constraint = await db
			.collection("unique_constraints")
			.doc(`nic_${parsed.data.nic}`)
			.get();
		const applicationId = asString(constraint.data()?.appId);

		if (!applicationId) {
			return NextResponse.json(
				{
					error:
						"We could not verify that application. Check your NIC and try again.",
				},
				{ status: 404 },
			);
		}

		const application = await db
			.collection("applications")
			.doc(applicationId)
			.get();
		if (!application.exists) {
			return NextResponse.json(
				{
					error:
						"We could not verify that application. Check your NIC and try again.",
				},
				{ status: 404 },
			);
		}

		const applicationData = asRecord(application.data());
		const personalInfo = asRecord(applicationData.personalInfo);
		const academicInfo = asRecord(applicationData.academicInfo);
		const awardSelection = asRecord(applicationData.awardSelection);
		const selectedAwards = asStringArray(awardSelection.selectedAwards);

		const updatedApplications = await db
			.collection("updatedApplications")
			.where("applicationId", "==", applicationId)
			.limit(1)
			.get();
		const registrationData = asRecord(updatedApplications.docs[0]?.data());
		const submission = await db
			.collection("portfolioSubmissions")
			.doc(applicationId)
			.get();
		const submissionData = asRecord(submission.data());
		const awardRegistrations = Array.isArray(
			registrationData.awardRegistrations,
		)
			? registrationData.awardRegistrations.flatMap((registration) => {
					const value = asRecord(registration);
					const code = asString(value.awardCode);
					if (!code) return [];

					return [
						{
							code,
							label: asString(value.awardLabel) ?? formatAwardCode(code),
							registrationNumber: asString(value.registrationNumber),
							status: asString(value.status),
						},
					];
				})
			: selectedAwards.map((code) => ({
					code,
					label: formatAwardCode(code),
					registrationNumber: undefined,
					status: undefined,
				}));

		return NextResponse.json({
			application: {
				applicationReferenceNumber: asString(
					registrationData.applicationReferenceNumber,
				),
				applicant: {
					email: asString(personalInfo.email),
					mobileNumber: asString(personalInfo.mobileNumber),
					name: asString(personalInfo.publicDisplayName),
				},
				academic: {
					faculty: asString(academicInfo.faculty),
					university: asString(academicInfo.university),
					universityEmail: asString(academicInfo.universityEmail),
					universityRegistrationNumber: asString(
						academicInfo.universityRegistrationNumber,
					),
				},
				awards: awardRegistrations,
				submission: {
					hasSubmission: submission.exists,
					status: asString(submissionData.submissionStatus) ?? "not_submitted",
				},
			},
		});
	} catch (error) {
		console.error(
			"[Portfolio verification] Failed to verify application:",
			error,
		);
		return NextResponse.json(
			{
				error:
					"We could not verify your application right now. Please try again.",
			},
			{ status: 500 },
		);
	}
}
