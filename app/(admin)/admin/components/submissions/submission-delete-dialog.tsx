"use client";

import { Loader2, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

export interface SubmissionDeleteTarget {
	applicationId: string;
	applicationReferenceNumber?: string;
	applicantName?: string;
	deletedFileCount: number;
	nic?: string;
	submissionStatus: string;
}

interface SubmissionDeleteDialogProps {
	loading: boolean;
	onClose: () => void;
	onConfirm: () => void;
	target: SubmissionDeleteTarget | null;
}

export default function SubmissionDeleteDialog({
	loading,
	onClose,
	onConfirm,
	target,
}: SubmissionDeleteDialogProps) {
	if (!target) return null;

	const fileLabel =
		target.deletedFileCount === 1
			? "1 document"
			: `${target.deletedFileCount} documents`;

	return (
		<Dialog open={Boolean(target)} onOpenChange={loading ? undefined : onClose}>
			<DialogContent className="rounded-2xl border-red-400/30 bg-slate-900 text-slate-100 sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="font-title text-2xl text-red-200">
						Delete portfolio submission
					</DialogTitle>
					<DialogDescription className="text-slate-400">
						This permanently removes the submitted documents for the applicant
						below. It cannot be undone.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 text-sm">
					<div className="rounded-xl border border-slate-700/60 bg-background/40 p-4">
						<dl className="space-y-2">
							<div className="flex justify-between gap-4">
								<dt className="text-slate-500">Applicant</dt>
								<dd className="text-right font-medium text-slate-100">
									{target.applicantName ?? "Unknown"}
								</dd>
							</div>
							{target.nic ? (
								<div className="flex justify-between gap-4">
									<dt className="text-slate-500">NIC</dt>
									<dd className="text-right font-medium text-slate-100">
										{target.nic}
									</dd>
								</div>
							) : null}
							{target.applicationReferenceNumber ? (
								<div className="flex justify-between gap-4">
									<dt className="text-slate-500">Reference</dt>
									<dd className="text-right font-medium text-slate-100">
										{target.applicationReferenceNumber}
									</dd>
								</div>
							) : null}
							<div className="flex justify-between gap-4">
								<dt className="text-slate-500">Current status</dt>
								<dd className="text-right font-medium text-slate-100">
									{target.submissionStatus.replaceAll("_", " ")}
								</dd>
							</div>
						</dl>
					</div>

				</div>

				<DialogFooter className="gap-2">
					<Button
						className="rounded-[8px] border-slate-600 text-slate-300 hover:bg-slate-100"
						disabled={loading}
						onClick={onClose}
						variant="outline"
					>
						Cancel
					</Button>
					<Button
						className="rounded-[8px] bg-red-300 hover:bg-red-400"
						disabled={loading}
						onClick={onConfirm}
					>
						{loading ? (
							<Loader2 className="mr-2 size-4 animate-spin" />
						) : (
							<Trash2 className="mr-2 size-4" />
						)}
						  Delete
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
