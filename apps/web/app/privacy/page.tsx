import { PolicyPage } from "@/components/store/PolicyPage";
export const dynamic = "force-dynamic";
export const metadata = { title: "الخصوصية", alternates: { canonical: "/privacy" } };
export default function Page() {
    return <PolicyPage kind="privacy" />;
}
