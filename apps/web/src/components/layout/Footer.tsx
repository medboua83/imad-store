import Link from "next/link";
export function Footer() {
    return (
        <footer className="border-t bg-[#F5EDE0] py-10 px-5">
            <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-8">
                <div>
                    <p className="text-2xl tracking-widest">IMAD MODE</p>
                    <p className="mt-3">اختيارك يبدأ من هنا.</p>
                </div>
                <nav aria-label="معلومات المتجر" className="flex flex-col gap-3">
                    {[
                        ["/shop", "المتجر"],
                        ["/contact", "تواصل معنا"],
                        ["/delivery", "التوصيل"],
                        ["/returns", "الاستبدال والإرجاع"],
                        ["/privacy", "الخصوصية"],
                    ].map(([href, label]) => (
                        <Link className="action" key={href} href={href}>
                            {label}
                        </Link>
                    ))}
                </nav>
                <p className="leading-8">
                    تجدين تفاصيل المنتجات والتوفر في المتجر، ورسوم التوصيل في ملخص الطلب قبل
                    التأكيد.
                </p>
            </div>
            <p className="text-center text-sm mt-8">© {new Date().getFullYear()} IMAD Mode</p>
        </footer>
    );
}
