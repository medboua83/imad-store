import { PolicyPage } from "@/components/store/PolicyPage";
export const dynamic = "force-dynamic";
export const metadata = { title: "الاستبدال والإرجاع", alternates: { canonical: "/returns" } };
export default function Page() {
    return <PolicyPage kind="returns" />;
}
