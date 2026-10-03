"use client";

import { CheckCircle2, Loader2, Mail, Send, XCircle } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

export type SendResultItem = {
	applicationId: string;
	registrationNumber: string;
	recipientName: string;
	recipientEmail: string;
	status: "pending" | "sending" | "accepted" | "failed";
	message?: string;
};

type SendProgressDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	results: SendResultItem[];
	isSending: boolean;
};

function StatusIcon({ status }: { status: SendResultItem["status"] }) {
	switch (status) {
		case "pending":
			return <div className="size-2 rounded-full bg-slate-500/60" />;
		case "sending":
			return <Loader2 className="size-4 animate-spin text-blue-400" />;
		case "accepted":
			return <CheckCircle2 className="size-4 text-emerald-400" />;
		case "failed":
			return <XCircle className="size-4 text-red-400" />;
	}
}

function StatusLabel({ status }: { status: SendResultItem["status"] }) {
	const styles: Record<SendResultItem["status"], string> = {
		pending: "text-slate-400",
		sending: "text-blue-300",
		accepted: "text-emerald-400",
		failed: "text-red-300",
	};
	const labels: Record<SendResultItem["status"], string> = {
		pending: "Queued",
		sending: "Sending...",
		accepted: "Sent",
		failed: "Failed",
	};
	return (
		<span className={`text-xs font-medium ${styles[status]}`}>
			{labels[status]}
		</span>
	);
}

export default function SendProgressDialog({
	open,
	onOpenChange,
	title,
	results,
	isSending,
}: SendProgressDialogProps) {
	const total = results.length;
	const sent = results.filter((r) => r.status === "accepted").length;
	const failed = results.filter((r) => r.status === "failed").length;
	const pending = results.filter(
		(r) => r.status === "pending" || r.status === "sending",
	).length;
	const progress = total > 0 ? ((sent + failed) / total) * 100 : 0;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg gap-0 overflow-hidden p-0 sm:max-w-xl">
				<DialogHeader className="border-border border-b bg-muted/30 px-6 py-4">
					<DialogTitle className="flex items-center gap-2 text-base">
						<Send className="size-4 text-amber-400" />
						{title}
					</DialogTitle>
				</DialogHeader>

				{/* Progress bar */}
				<div className="px-6 pt-4">
					<div className="mb-3 flex items-center justify-between text-xs">
						<span className="text-muted-foreground">
							{isSending ? "Sending..." : "Complete"}
						</span>
						<span className="tabular-nums text-foreground">
							{sent + failed} / {total}
						</span>
					</div>
					<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full transition-all duration-500 ease-out"
							style={{
								width: `${progress}%`,
								background:
									failed > 0 && !isSending
										? "linear-gradient(90deg, #10b981 0%, #10b981 70%, #ef4444 100%)"
										: "#10b981",
							}}
						/>
					</div>
					<div className="mt-3 flex gap-4 text-xs">
						{sent > 0 && (
							<span className="flex items-center gap-1.5 text-emerald-400">
								<CheckCircle2 className="size-3" />
								{sent} sent
							</span>
						)}
						{failed > 0 && (
							<span className="flex items-center gap-1.5 text-red-400">
								<XCircle className="size-3" />
								{failed} failed
							</span>
						)}
						{pending > 0 && (
							<span className="flex items-center gap-1.5 text-blue-300">
								<Loader2 className="size-3 animate-spin" />
								{pending} pending
							</span>
						)}
					</div>
				</div>

				{/* Recipient list */}
				<div className="max-h-72 overflow-y-auto px-6 py-3">
					<ul className="divide-y divide-border/50">
						{results.map((item) => (
							<li
								className="flex items-center gap-3 py-2.5"
								key={item.applicationId}
							>
								<StatusIcon status={item.status} />
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="truncate text-sm font-medium text-foreground">
											{item.recipientName}
										</p>
										<span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
											{item.registrationNumber}
										</span>
									</div>
									<p className="mt-0.5 truncate text-xs text-muted-foreground">
										{item.recipientEmail}
									</p>
									{item.message && item.status === "failed" && (
										<p className="mt-1 text-[11px] text-red-300/80">
											{item.message}
										</p>
									)}
								</div>
								<StatusLabel status={item.status} />
							</li>
						))}
					</ul>
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between border-border border-t bg-muted/30 px-6 py-3">
					<p className="text-muted-foreground text-xs">
						<Mail className="mr-1 inline-block size-3" />
						{total} recipient{total !== 1 ? "s" : ""}
					</p>
					<button
						className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/80"
						onClick={() => onOpenChange(false)}
						type="button"
					>
						{isSending ? "Run in background" : "Close"}
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
