import { NextResponse } from "next/server";
import { Resend } from "resend";
import { updateMessageFromWebhook } from "@/app/(admin)/admin/EmailService/service/db-transaction/message-webhook-transaction";

/** Verifies and processes public Resend webhook requests. */
export async function POST(request: Request) {
	const eventId = request.headers.get("svix-id") ?? "";
	const timestamp = request.headers.get("svix-timestamp") ?? "";
	const signature = request.headers.get("svix-signature") ?? "";
	const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
	const apiKey = process.env.RESEND_API_KEY;
	if (!webhookSecret || !apiKey) {
		console.error(
			"[ResendWebhook] RESEND_API_KEY or RESEND_WEBHOOK_SECRET is not configured.",
		);
		return NextResponse.json(
			{ error: "Webhook is not configured." },
			{ status: 500 },
		);
	}
	if (!eventId || !timestamp || !signature) {
		return NextResponse.json(
			{ error: "Missing webhook signature." },
			{ status: 400 },
		);
	}

	const payload = await request.text();
	const resend = new Resend(apiKey);
	let event: ReturnType<typeof resend.webhooks.verify>;
	try {
		event = resend.webhooks.verify({
			payload,
			headers: { id: eventId, timestamp, signature },
			webhookSecret,
		});
	} catch (error) {
		console.error("[ResendWebhook] Signature verification failed:", error);
		return NextResponse.json(
			{ error: "Invalid webhook signature." },
			{ status: 400 },
		);
	}

	try {
		const result = await updateMessageFromWebhook({
			eventId,
			type: event.type,
			data: event.data as unknown as Record<string, unknown>,
		});
		return NextResponse.json({ received: true, ...result });
	} catch (error) {
		console.error("[ResendWebhook] Database update failed:", error);
		return NextResponse.json(
			{ error: "Webhook processing failed." },
			{ status: 500 },
		);
	}
}
