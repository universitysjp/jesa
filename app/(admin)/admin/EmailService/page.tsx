import { redirect } from "next/navigation";
import { getAdminUserFromCookies } from "@/app/admin/lib/server-auth";
import EmailServiceUI from "./EmailServiceUI";

export const dynamic = "force-dynamic";

/** Allows only approved admins to open the Email Service workspace. */
export default async function EmailServicePage() {
	const admin = await getAdminUserFromCookies();
	if (!admin) redirect("/signin");

	return <EmailServiceUI />;
}
