import { describe, expect, it } from "bun:test";
import {
	createPortfolioFileName,
	createPortfolioObjectKey,
	normalizeNicSegment,
	slugifyApplicantName,
} from "@/lib/portfolio-file-name";

const APPLICANT = {
	applicantName: "Dilmi Elapatha",
	applicationId: "0633a1db-b904-4593-94a3-78558ca95d24",
	registrationYear: 2026,
};

describe("slugifyApplicantName", () => {
	it("lowercases and hyphenates a plain name", () => {
		expect(slugifyApplicantName("Tharindu Dinethra")).toBe("tharindu-dinethra");
	});

	it("strips accents and collapses punctuation", () => {
		expect(slugifyApplicantName("José  María  O'Brien")).toBe(
			"jose-maria-o-brien",
		);
	});

	it("falls back when the name has no usable characters", () => {
		expect(slugifyApplicantName("!!!")).toBe("applicant");
		expect(slugifyApplicantName(undefined)).toBe("applicant");
	});
});

describe("normalizeNicSegment", () => {
	it("accepts an old-format NIC and uppercases the suffix", () => {
		expect(normalizeNicSegment("991690883v")).toBe("991690883V");
		expect(normalizeNicSegment("991690883x")).toBe("991690883X");
	});

	it("accepts a new-format 12 digit NIC", () => {
		expect(normalizeNicSegment("200254601504")).toBe("200254601504");
	});

	it("trims surrounding whitespace", () => {
		expect(normalizeNicSegment("  200254601504 ")).toBe("200254601504");
	});

	it("rejects values that are not a recognised NIC shape", () => {
		expect(normalizeNicSegment("12345")).toBeNull();
		expect(normalizeNicSegment("abcdefghijk")).toBeNull();
		expect(normalizeNicSegment("20025460150")).toBeNull();
		expect(normalizeNicSegment("")).toBeNull();
		expect(normalizeNicSegment(undefined)).toBeNull();
		expect(normalizeNicSegment(null)).toBeNull();
	});

	it("rejects path traversal attempts", () => {
		expect(normalizeNicSegment("../../etc/passwd")).toBeNull();
		expect(normalizeNicSegment("2002546015/04")).toBeNull();
	});
});

describe("createPortfolioFileName", () => {
	it("includes the NIC for each document type", () => {
		expect(
			createPortfolioFileName({
				applicantName: "Dilmi Elapatha",
				documentType: "portfolio",
				nic: "200254601504",
			}),
		).toBe("dilmi-elapatha-200254601504-portfolio.pdf");

		expect(
			createPortfolioFileName({
				applicantName: "Dilmi Elapatha",
				documentType: "businessPlan",
				nic: "200254601504",
			}),
		).toBe("dilmi-elapatha-200254601504-business-plan.pdf");

		expect(
			createPortfolioFileName({
				applicantName: "Dilmi Elapatha",
				documentType: "csrReport",
				nic: "200254601504",
			}),
		).toBe("dilmi-elapatha-200254601504-csr-report.pdf");
	});

	it("falls back to name-only when the NIC is unusable", () => {
		expect(
			createPortfolioFileName({
				applicantName: "Dilmi Elapatha",
				documentType: "portfolio",
				nic: "not-a-nic",
			}),
		).toBe("dilmi-elapatha-portfolio.pdf");

		expect(
			createPortfolioFileName({
				applicantName: "Dilmi Elapatha",
				documentType: "portfolio",
				nic: undefined,
			}),
		).toBe("dilmi-elapatha-portfolio.pdf");
	});
});

describe("createPortfolioObjectKey", () => {
	it("nests the file under the registration year and application id", () => {
		expect(
			createPortfolioObjectKey({
				...APPLICANT,
				documentType: "portfolio",
				nic: "200254601504",
			}),
		).toBe(
			"2026/0633a1db-b904-4593-94a3-78558ca95d24/dilmi-elapatha-200254601504-portfolio.pdf",
		);
	});

	it("derives the same key regardless of NIC casing", () => {
		const lower = createPortfolioObjectKey({
			...APPLICANT,
			documentType: "portfolio",
			nic: "991690883v",
		});
		const upper = createPortfolioObjectKey({
			...APPLICANT,
			documentType: "portfolio",
			nic: "991690883V",
		});

		expect(lower).toBe(upper);
	});

	it("keeps each document type in its own key", () => {
		const keys = (["portfolio", "businessPlan", "csrReport"] as const).map(
			(documentType) =>
				createPortfolioObjectKey({
					...APPLICANT,
					documentType,
					nic: "200254601504",
				}),
		);

		expect(new Set(keys).size).toBe(3);
	});
});
