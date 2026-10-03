"use client";

import { Monitor, Smartphone } from "lucide-react";
import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import RegistrationEmail from "./registration-email";
import type { MessageRecord } from "./service/types";

type EmailPreviewDialogProps = {
	record: MessageRecord | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

type DeviceMode = "desktop" | "mobile";

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
	desktop: "100%",
	mobile: "375px",
};

/** Builds award data for the email preview from real message record data. */
function getPreviewAwards(record: MessageRecord) {
	if (record.awards.length > 0) {
		return record.awards.map((award) => ({
			label: award.label,
			registrationNumber: award.registrationNumber,
			whatsappUrl: award.whatsappUrl,
		}));
	}
	return [
		{
			label: "Best Paper Award",
			registrationNumber: "REG-2026-0001",
			whatsappUrl: "https://chat.whatsapp.com/example",
		},
	];
}

export default function EmailPreviewDialog({
	record,
	open,
	onOpenChange,
}: EmailPreviewDialogProps) {
	const [device, setDevice] = useState<DeviceMode>("desktop");

	if (!record) return null;

	const awards = getPreviewAwards(record);
	const html = RegistrationEmail({
		recipientName: record.recipient.name,
		applicationReferenceNumber: record.registrationNumber,
		awards,
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl gap-0 overflow-hidden p-0 sm:max-w-5xl">
				<DialogHeader className="flex flex-row items-center justify-between border-border border-b bg-muted/30 px-6 py-4">
					<div className="flex items-center gap-3">
						<DialogTitle className="text-base">Email Preview</DialogTitle>
						<span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground text-xs">
							{record.registrationNumber}
						</span>
					</div>
					<div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
						<button
							className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
								device === "desktop"
									? "bg-muted text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground"
							}`}
							onClick={() => setDevice("desktop")}
							type="button"
						>
							<Monitor className="size-3.5" />
							Desktop
						</button>
						<button
							className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
								device === "mobile"
									? "bg-muted text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground"
							}`}
							onClick={() => setDevice("mobile")}
							type="button"
						>
							<Smartphone className="size-3.5" />
							Mobile
						</button>
					</div>
				</DialogHeader>

				<div
					className="flex justify-center overflow-auto p-4 sm:p-6"
					style={{ backgroundColor: "#1c1029" }}
				>
					<div
						className="overflow-hidden rounded-lg border border-slate-800 shadow-2xl transition-all duration-300"
						style={{
							width: DEVICE_WIDTHS[device],
							maxWidth: "100%",
						}}
					>
						{device === "mobile" && (
							<div className="flex items-center gap-2 border-slate-800 border-b bg-slate-900 px-4 py-2">
								<div className="flex gap-1.5">
									<span className="size-2.5 rounded-full bg-red-500/80" />
									<span className="size-2.5 rounded-full bg-yellow-500/80" />
									<span className="size-2.5 rounded-full bg-green-500/80" />
								</div>
								<div className="mx-auto max-w-[200px] flex-1 truncate rounded-md bg-slate-800 px-3 py-1 text-center text-slate-400 text-xs">
									mail.example.com
								</div>
							</div>
						)}
						<iframe
							className="h-[600px] w-full bg-white sm:h-[700px]"
							srcDoc={html}
							title="Email preview"
						/>
					</div>
				</div>

				<div className="flex items-center justify-between border-border border-t bg-muted/30 px-6 py-3">
					<div className="flex items-center gap-4 text-muted-foreground text-xs">
						<span>
							To:{" "}
							<span className="text-foreground">{record.recipient.email}</span>
						</span>
						<span>
							Awards: <span className="text-foreground">{awards.length}</span>
						</span>
					</div>
					<button
						className="flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
						onClick={() => {
							navigator.clipboard.writeText(html);
						}}
						type="button"
					>
						Copy HTML
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
