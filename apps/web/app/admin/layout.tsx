import { AdminLocaleProvider } from "./admin-locale";
export const metadata = { title: "Administration", robots: { index: false, follow: false } };
export default function PrivateLayout({ children }: { children: React.ReactNode }) {
    return <AdminLocaleProvider>{children}</AdminLocaleProvider>;
}
