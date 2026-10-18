import { PolicyPage } from "@/components/store/PolicyPage";
export const dynamic = "force-dynamic";
export const metadata = { title: "التوصيل والدفع", alternates: { canonical: "/delivery" } };
export default function Page() {
    return <PolicyPage kind="delivery" />;
}
