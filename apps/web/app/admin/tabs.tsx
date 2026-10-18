"use client";
import { useState, useRef, useMemo, useCallback } from "react";
import { DollarSign, ShoppingCart, Pencil, Trash2, UploadCloud, TrendingUp, TrendingDown, Banknote, Target, CheckCircle2, XCircle, RefreshCw, ExternalLink } from "lucide-react";
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import type { LucideIcon } from "lucide-react";
import type { Product, Category } from "@/lib/api";
import { updateOrderStatus } from "@/lib/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const handleImageUpload = (file: File): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
    });
};

const ImageUploadArea = ({ onUpload, currentImage, className = "" }: { onUpload: (url: string) => void, currentImage?: string, className?: string }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault(); setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) onUpload(await handleImageUpload(file));
    };

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onUpload(await handleImageUpload(file));
    };

    return (
        <div 
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            role="button" tabIndex={0} aria-label="Choisir une image"
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
            onClick={() => inputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer transition-colors overflow-hidden group ${dragging ? 'border-[#C9A96E] bg-[#C9A96E]/10' : 'border-white/20 hover:border-white/40'} ${className}`}
        >
            <input ref={inputRef} type="file" accept="image/*" onChange={handleChange} className="hidden" />
            {currentImage ? (
                <>
                    <img src={currentImage} alt="Uploaded" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="text-xs font-bold uppercase tracking-widest text-white">Change Image</span>
                    </div>
                </>
            ) : (
                <div className="p-4 text-center">
                    <UploadCloud className="mx-auto mb-2 text-white/40" size={24} />
                    <span className="text-[10px] uppercase tracking-widest text-white/50">Drop image or click</span>
                </div>
            )}
        </div>
    );
};

    const CATEGORY_LABELS: Record<string, string> = {
        'bags':         'الحقائب',
        'abayas':       'العبايات',
        'shawls':       'شيلان',
        'womens-shoes': 'أحذية نسائية',
        'mens-clogs':   'صابو رجالي',
    };
    // All 5 columns always present — start with zero revenue
    const ORDERED_CATS = Object.keys(CATEGORY_LABELS);

interface OrderItem { quantity: number; unitPrice: number; productId?: string; }
interface Order { id: string; status: string; totalAmount: number; shippingCost?: number; createdAt: string; items?: OrderItem[]; }

// ─── Chart tooltip style ──────────────────────────────────────────────────────
const TOOLTIP_STYLE = { backgroundColor: '#1e1e3a', border: '1px solid rgba(201,169,110,0.3)', borderRadius: '8px', color: '#fff', fontSize: '11px' };
const PIE_COLORS = ['#fbbf24', '#60a5fa', '#34d399', '#f87171', '#a78bfa'];

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { color?: string; name?: string; value?: number | string }[]; label?: string | number }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={TOOLTIP_STYLE} className="px-3 py-2">
            <p className="text-[10px] text-white/50 mb-1">{label}</p>
            {payload.map((p, i: number) => (
                <p key={i} style={{ color: p.color }} className="text-xs font-medium">
                    {p.name}: {typeof p.value === 'number' ? `${p.value.toFixed(2)} MAD` : p.value}
                </p>
            ))}
        </div>
    );
};

// ─── Section Title ────────────────────────────────────────────────────────────
const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-[10px] tracking-[0.3em] uppercase text-[#C9A96E] mb-4 font-semibold">{children}</h3>
);

// ─── Glass Card ───────────────────────────────────────────────────────────────
const GlassCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 ${className}`}>
        {children}
    </div>
);

// ─── Overview Tab ─────────────────────────────────────────────────────────────
export function OverviewTab({ orders, products }: { orders: Order[]; products: Product[] }) {
    const now = new Date();

    // ── Core metrics ──────────────────────────────────────────────────────────
    const totalRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
    const totalShipping = orders.reduce((s, o) => s + (o.shippingCost ?? 0), 0);
    const netSales = totalRevenue - totalShipping;
    const netProfit = netSales * 0.60; // Estimated 60% margin
    const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;
    const pending = orders.filter(o => o.status === 'PENDING').length;
    const confirmed = orders.filter(o => o.status === 'CONFIRMED').length;
    const delivered = orders.filter(o => o.status === 'DELIVERED').length;
    const cancelled = orders.filter(o => o.status === 'CANCELLED').length;
    const pendingCOD = orders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED').reduce((s, o) => s + o.totalAmount, 0);

    // ── Month-over-month growth ───────────────────────────────────────────────
    const thisMonthOrders = orders.filter(o => {
        const d = new Date(o.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const lastMonthOrders = orders.filter(o => {
        const d = new Date(o.createdAt);
        const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
    });
    const thisMonthRev = thisMonthOrders.reduce((s, o) => s + o.totalAmount, 0);
    const lastMonthRev = lastMonthOrders.reduce((s, o) => s + o.totalAmount, 0);
    const growth = lastMonthRev > 0 ? ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100 : 0;

    // ── Revenue trend (last 14 days) ──────────────────────────────────────────
    const revenueTrend = useMemo(() => {
        const now = new Date();
        const days: Record<string, { revenue: number; orders: number }> = {};
        for (let i = 13; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const key = d.toLocaleDateString('fr-MA', { day: '2-digit', month: 'short' });
            days[key] = { revenue: 0, orders: 0 };
        }
        orders.forEach(o => {
            const key = new Date(o.createdAt).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short' });
            if (days[key]) { days[key].revenue += o.totalAmount; days[key].orders += 1; }
        });
        return Object.entries(days).map(([date, v]) => ({ date, ...v }));
    }, [orders]);

    // ── Category revenue ──────────────────────────────────────────────────────
    // Slug → Arabic label mapping (matches exactly what seedAdmin inserts)

    const categoryRevenue = (() => {
        // Base map with 0 for every category so all bars render
        const catMap: Record<string, number> = {};
        ORDERED_CATS.forEach(slug => { catMap[CATEGORY_LABELS[slug]] = 0; });

        orders.forEach(o => {
            (o.items || []).forEach(item => {
                const prod = products.find(p => p.id === item.productId);
                const catSlug = prod?.category?.slug ?? 'bags';
                // Map to a known slug; unknown slugs fall back to 'bags'
                const resolvedSlug = CATEGORY_LABELS[catSlug] ? catSlug : 'bags';
                const label = CATEGORY_LABELS[resolvedSlug];
                catMap[label] = (catMap[label] ?? 0) + item.unitPrice * item.quantity;
            });
        });

        // Preserve the canonical order (not sorted by revenue) so columns are stable
        return ORDERED_CATS.map(slug => ({ category: CATEGORY_LABELS[slug], revenue: catMap[CATEGORY_LABELS[slug]] }));
    })();

    // ── Order status pie ──────────────────────────────────────────────────────
    const statusData = [
        { name: 'قيد الانتظار', value: pending },
        { name: 'مؤكد', value: confirmed },
        { name: 'تم التسليم', value: delivered },
        { name: 'ملغي', value: cancelled },
    ].filter(s => s.value > 0);

    const kpiCards = [
        { icon: DollarSign, label: 'إجمالي المبيعات', value: `${totalRevenue.toFixed(2)} MAD`, sub: growth >= 0 ? `+${growth.toFixed(1)}% هذا الشهر` : `${growth.toFixed(1)}% هذا الشهر`, color: '#C9A96E', trend: growth },
        { icon: Banknote, label: 'صافي الربح (تقديري)', value: `${netProfit.toFixed(2)} MAD`, sub: 'هامش ربح 60%', color: '#34d399', trend: 1 },
        { icon: Target, label: 'متوسط قيمة الطلب', value: `${avgOrderValue.toFixed(2)} MAD`, sub: `${orders.length} طلب إجمالاً`, color: '#a78bfa', trend: 1 },
        { icon: ShoppingCart, label: 'إجمالي الطلبات', value: String(orders.length), sub: `${pending} قيد الانتظار · ${delivered} مسلّم`, color: '#60a5fa', trend: 0 },
    ];

    return (
        <div className="space-y-8" dir="rtl">
            {/* ── Page header ──────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-light tracking-widest" style={{ fontFamily: "'Cormorant Garamond', serif" }}>لوحة التحليلات المالية</h2>
                    <p className="text-[10px] text-white/30 tracking-widest uppercase mt-1">Financial Analytics Dashboard</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] text-white/30 tracking-widest uppercase">Last updated</p>
                    <p className="text-xs text-[#C9A96E] font-mono mt-0.5" suppressHydrationWarning>{new Date().toLocaleString('fr-MA')}</p>
                </div>
            </div>

            {/* ── KPI Cards ────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {kpiCards.map(({ icon: Icon, label, value, sub, color, trend }) => (
                    <GlassCard key={label}>
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-2.5 rounded-xl" style={{ background: `${color}18` }}>
                                <Icon size={18} style={{ color }} />
                            </div>
                            <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${
                                trend > 0 ? 'bg-emerald-500/15 text-emerald-400' :
                                trend < 0 ? 'bg-red-500/15 text-red-400' :
                                'bg-white/5 text-white/30'
                            }`}>
                                {trend > 0 ? <TrendingUp size={10} /> : trend < 0 ? <TrendingDown size={10} /> : null}
                                {trend !== 0 ? `${Math.abs(trend).toFixed(1)}%` : '—'}
                            </div>
                        </div>
                        <p className="text-[10px] tracking-[0.2em] uppercase text-white/40 mb-1">{label}</p>
                        <p className="text-xl font-light tracking-wide" style={{ color }}>{value}</p>
                        <p className="text-[10px] text-white/25 mt-1">{sub}</p>
                    </GlassCard>
                ))}
            </div>

            {/* ── Charts Row ───────────────────────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Revenue Area Chart */}
                <GlassCard className="xl:col-span-2">
                    <SectionTitle>منحنى المبيعات — آخر 14 يوم</SectionTitle>
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={revenueTrend} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#C9A96E" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#C9A96E" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} width={55} tickFormatter={v => `${v} د`} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="revenue" name="مبيعات (MAD)" stroke="#C9A96E" strokeWidth={2} fill="url(#revGrad)" dot={false} />
                            <Area type="monotone" dataKey="orders" name="عدد الطلبات" stroke="#60a5fa" strokeWidth={1.5} fill="url(#ordGrad)" dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </GlassCard>

                {/* Order Status Pie */}
                <GlassCard>
                    <SectionTitle>توزيع حالات الطلبات</SectionTitle>
                    {statusData.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height={160}>
                                <PieChart>
                                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                                        dataKey="value" paddingAngle={3} strokeWidth={0}>
                                        {statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="space-y-2 mt-2">
                                {statusData.map((s, i) => (
                                    <div key={s.name} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                            <span className="text-white/60">{s.name}</span>
                                        </div>
                                        <span className="font-medium text-white/90">{s.value}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="h-40 flex items-center justify-center text-white/20 text-xs">لا توجد طلبات بعد</div>
                    )}
                </GlassCard>
            </div>

            {/* ── Category Revenue Bar Chart ───────────────────────────── */}
            <GlassCard>
                <SectionTitle>المبيعات حسب الفئة</SectionTitle>
                <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={categoryRevenue} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="category" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} width={55} tickFormatter={v => `${v} د`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="revenue" name="المبيعات (MAD)" radius={[6, 6, 0, 0]} maxBarSize={50}>
                            {categoryRevenue.map((_, i) => <Cell key={i} fill={i === 0 ? '#C9A96E' : `rgba(201,169,110,${0.7 - i * 0.08})`} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </GlassCard>

            {/* ── Accounting Breakdown Table ───────────────────────────── */}
            <GlassCard>
                <SectionTitle>ملخص الحسابات المالية</SectionTitle>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/10">
                                {['البند', 'المبلغ (MAD)', 'ملاحظات'].map(h => (
                                    <th key={h} className="text-right text-[10px] tracking-[0.2em] uppercase text-white/30 py-3 px-4 font-normal">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {[
                                { label: 'إجمالي المبيعات (Gross Revenue)', value: totalRevenue, note: `${orders.length} طلب`, highlight: false },
                                { label: 'رسوم الشحن المحصلة', value: totalShipping, note: 'COD Shipping Fees', highlight: false },
                                { label: 'صافي المبيعات (Net Sales)', value: netSales, note: 'Gross - Shipping', highlight: true },
                                { label: 'صافي الربح التقديري (60%)', value: netProfit, note: 'هامش ربح مقدر بـ 60%', highlight: true },
                                { label: 'مبالغ COD قيد التحصيل', value: pendingCOD, note: `${pending + confirmed} طلب معلق`, highlight: false },
                            ].map(row => (
                                <tr key={row.label} className={row.highlight ? 'bg-[#C9A96E]/5' : ''}>
                                    <td className={`py-4 px-4 text-xs ${row.highlight ? 'text-[#C9A96E] font-semibold' : 'text-white/70'}`}>{row.label}</td>
                                    <td className={`py-4 px-4 font-mono font-medium ${row.highlight ? 'text-[#C9A96E]' : 'text-white'}`}>
                                        {row.value.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-4 px-4 text-[10px] text-white/30">{row.note}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </GlassCard>
        </div>
    );
}

// ─── Products Tab ─────────────────────────────────────────────────────────────
export { ProductsTab } from "./products-tab";

// ─── Banners Tab ──────────────────────────────────────────────────────────────
interface Banner { imageUrl: string; linkUrl: string; title: string; }

export function BannersTab() {
    const [banners, setBanners] = useState<Banner[]>(() => {
        if (typeof window !== "undefined") { try { return JSON.parse(localStorage.getItem("siteBanners") || "[]"); } catch { return []; } }
        return [];
    });
    const [form, setForm] = useState<Banner>({ imageUrl: "", linkUrl: "", title: "" });
    const [editIdx, setEditIdx] = useState<number | null>(null);

    const saveBanners = (b: Banner[]) => { setBanners(b); localStorage.setItem("siteBanners", JSON.stringify(b)); };
    const addOrUpdate = () => {
        if (!form.imageUrl) return;
        if (editIdx !== null) { const b = [...banners]; b[editIdx] = form; saveBanners(b); }
        else saveBanners([...banners, form]);
        setForm({ imageUrl: "", linkUrl: "", title: "" }); setEditIdx(null);
    };

    const inp = "w-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#C9A96E] rounded";

    return (
        <div>
            <h2 className="text-lg tracking-widest uppercase mb-6">Site Banners</h2>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <ImageUploadArea onUpload={(url) => setForm(f => ({ ...f, imageUrl: url }))} currentImage={form.imageUrl} className="w-full md:w-64 h-32" />
                    <div className="flex-1 space-y-3">
                        <input className={inp} placeholder="Link URL (optional)" value={form.linkUrl} onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))} />
                        <input className={inp} placeholder="Title / Alt text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                    </div>
                </div>
                <button onClick={addOrUpdate} className="bg-[#C9A96E] text-[#1A1A2E] px-4 py-2 text-[10px] tracking-widest uppercase font-bold rounded">Save Banner</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {banners.map((b, i) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden relative group aspect-[16/7]">
                        <img src={b.imageUrl} alt={b.title || "Banner"} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                            <button onClick={() => { setEditIdx(i); setForm(b); }} className="bg-white/20 p-2 rounded hover:bg-white/40"><Pencil size={14}/></button>
                            <button onClick={() => saveBanners(banners.filter((_, j) => j !== i))} className="bg-red-500/50 p-2 rounded hover:bg-red-500/80"><Trash2 size={14}/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────
export function CategoriesTab({ categories, onCreate, onDelete }: { categories: Category[], onCreate: (d: Record<string, unknown>) => Promise<void>, onDelete: (id: string) => Promise<void> }) {
    const [form, setForm] = useState({ slug: "", nameEn: "", nameFr: "", nameAr: "" });
    const inp = "w-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white rounded mb-2";

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onCreate(form);
        setForm({ slug: "", nameEn: "", nameFr: "", nameAr: "" });
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <h2 className="text-lg tracking-widest uppercase mb-6">Add Category</h2>
                <form onSubmit={submit} className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <input className={inp} placeholder="Slug (e.g. abaya)" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} required />
                    <input className={inp} placeholder="Name (EN)" value={form.nameEn} onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))} required />
                    <input className={inp} placeholder="Name (FR)" value={form.nameFr} onChange={e => setForm(f => ({ ...f, nameFr: e.target.value }))} required />
                    <input className={inp} placeholder="Name (AR)" value={form.nameAr} onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))} required />
                    <button type="submit" className="mt-2 bg-[#C9A96E] text-[#1A1A2E] px-4 py-2 text-[10px] tracking-widest uppercase font-bold rounded">Create Category</button>
                </form>
            </div>
            <div>
                <h2 className="text-lg tracking-widest uppercase mb-6">Existing Categories</h2>
                <div className="space-y-2">
                    {categories.map(c => (
                        <div key={c.id} className="bg-white/5 border border-white/10 p-4 rounded flex justify-between items-center">
                            <div>
                                <p className="font-medium text-sm">{c.nameEn}</p>
                                <p className="text-xs text-white/40">{c.slug}</p>
                            </div>
                            <button onClick={() => { if(confirm("Delete category?")) onDelete(c.id); }} className="text-red-400 hover:bg-white/5 p-2 rounded"><Trash2 size={14} /></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Homepage Builder Tab ─────────────────────────────────────────────────────
export function HomepageBuilderTab() {
    const defaultCategories = ['الحقائب', 'العبايات', 'شيلان', 'أحذية نسائية', 'بيجامات', 'سابو رجالي'].join(" • ");
    const defaultConfig = {
        "Hero Section": { title: "أناقة محتشمة", subtitle: defaultCategories, image: "" },
        "Featured Products": { title: "منتجات مميزة", subtitle: "أحدث التشكيلات", image: "" },
        "Promo Section": { title: "عروض خاصة", subtitle: "تسوقي الآن", image: "" },
        "Footer": { title: "IMAD Mode", subtitle: "توصيل لجميع أنحاء المغرب", image: "" }
    };

    const [config, setConfig] = useState(() => {
        if (typeof window !== "undefined") { 
            try { 
                const stored = JSON.parse(localStorage.getItem("homepageConfig") || "null");
                if (stored) return { ...defaultConfig, ...stored };
            } catch { return defaultConfig; } 
        }
        return defaultConfig;
    });
    
    const save = (c: Record<string, { title: string; subtitle: string; image: string }>) => { setConfig(c); localStorage.setItem("homepageConfig", JSON.stringify(c)); };
    const set = (section: string, field: string, value: string) => { save({ ...config, [section]: { ...(config[section] || {}), [field]: value } }); };

    const inp = "w-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white rounded";

    return (
        <div className="space-y-8">
            <h2 className="text-lg tracking-widest uppercase mb-6">Homepage Builder</h2>
            
            {["Hero Section", "Featured Products", "Promo Section", "Footer"].map(section => (
                <div key={section} className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <h3 className="text-sm tracking-[0.2em] uppercase text-[#C9A96E] mb-4">{section}</h3>
                    <div className="flex flex-col md:flex-row gap-4">
                        <ImageUploadArea 
                            onUpload={(url) => set(section, "image", url)} 
                            currentImage={config[section]?.image} 
                            className="w-full md:w-64 h-32" 
                        />
                        <div className="flex-1 space-y-4">
                            <input className={inp} placeholder="Title" value={config[section]?.title || ""} onChange={e => set(section, "title", e.target.value)} />
                            <input className={inp} placeholder="Subtitle" value={config[section]?.subtitle || ""} onChange={e => set(section, "subtitle", e.target.value)} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Toast System ─────────────────────────────────────────────────────────────────
export interface Toast { id: string; message: string; type: 'success' | 'error'; }

export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none">
            {toasts.map(t => (
                <div
                    key={t.id}
                    className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border text-sm font-medium tracking-wide transition-all duration-300 animate-in slide-in-from-bottom-4 ${
                        t.type === 'success'
                            ? 'bg-[#1e2d1e] border-emerald-500/40 text-emerald-300'
                            : 'bg-[#2d1e1e] border-red-500/40 text-red-300'
                    }`}
                    role="button" tabIndex={0} aria-label={`Fermer : ${t.message}`}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onDismiss(t.id); } }}
                    onClick={() => onDismiss(t.id)}
                >
                    {t.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <XCircle size={16} className="shrink-0" />}
                    {t.message}
                </div>
            ))}
        </div>
    );
}

export function useToast() {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const push = useCallback((message: string, type: Toast['type'] = 'success') => {
        const id = Math.random().toString(36).slice(2);
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    }, []);
    const dismiss = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);
    return { toasts, push, dismiss };
}

// ─── Orders Tab ─────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
    PENDING:   'bg-yellow-500/20 text-yellow-300',
    CONFIRMED: 'bg-blue-500/20 text-blue-300',
    SHIPPED:   'bg-purple-500/20 text-purple-300',
    DELIVERED: 'bg-emerald-500/20 text-emerald-300',
    CANCELLED: 'bg-red-500/20 text-red-300',
};

const STATUS_LABELS: Record<string, string> = {
    PENDING: 'قيد الانتظار', CONFIRMED: 'مؤكد', SHIPPED: 'تم الشحن',
    DELIVERED: 'مسلّم', CANCELLED: 'ملغي',
};

interface AdminOrderRow {
    id: string; customerName: string | null; customerPhone: string | null;
    city: string | null; status: string; paymentMethod: string;
    paymentStatus: string; totalAmount: number; createdAt: string;
}

export function OrdersTab({ orders, onRefresh }: { orders: AdminOrderRow[]; onRefresh: () => Promise<void> }) {
    const [updating, setUpdating] = useState<Record<string, boolean>>({});
    const { toasts, push, dismiss } = useToast();
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        let list = orders;
        if (filterStatus !== 'ALL') list = list.filter(o => o.status === filterStatus);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(o =>
                (o.customerName ?? '').toLowerCase().includes(q) ||
                (o.customerPhone ?? '').includes(q) ||
                o.id.toLowerCase().includes(q)
            );
        }
        return list;
    }, [orders, filterStatus, search]);

    const updateStatus = async (orderId: string, status: string, label: string) => {
        setUpdating(prev => ({ ...prev, [orderId]: true }));
        try {
            await updateOrderStatus(orderId, status);
            await onRefresh();
            push(`تم تحديث حالة الطلب إلى: ${label}`, 'success');
        } catch {
            push(`فشل تحديث الحالة`, 'error');
        } finally {
            setUpdating(prev => ({ ...prev, [orderId]: false }));
        }
    };

    const actionButtons = (o: AdminOrderRow) => {
        const busy = updating[o.id];
        const btn = (label: string, status: string, color: string, Icon: LucideIcon) => (
            <button
                key={status}
                disabled={busy || o.status === status}
                onClick={() => updateStatus(o.id, status, STATUS_LABELS[status])}
                title={label}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-[9px] tracking-[0.15em] uppercase font-bold rounded-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed ${color}`}
            >
                {busy ? <RefreshCw size={10} className="animate-spin" /> : <Icon size={10} />}
                {label}
            </button>
        );
        return (
            <div className="flex flex-wrap gap-1">
                {o.status !== 'CONFIRMED'  && o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && btn('تأكيد', 'CONFIRMED', 'bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 border border-blue-500/30', CheckCircle2)}
                {o.status !== 'DELIVERED'  && o.status !== 'CANCELLED' && btn('مسلّم', 'DELIVERED',  'bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/30', CheckCircle2)}
                {o.status !== 'CANCELLED'  && o.status !== 'DELIVERED' && btn('إلغاء', 'CANCELLED',  'bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/30', XCircle)}
            </div>
        );
    };

    return (
        <>
            <ToastContainer toasts={toasts} onDismiss={dismiss} />
            <div>
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-lg tracking-widest uppercase">إدارة الطلبات</h2>
                        <p className="text-[10px] text-white/30 tracking-widest mt-0.5">{orders.length} طلب إجمالاً</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Search */}
                        <input
                            type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="بحث بالاسم أو الهاتف..."
                            className="bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/30 rounded-lg outline-none focus:border-[#C9A96E] w-48"
                        />
                        {/* Status filter */}
                        <select
                            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                            className="bg-white/5 border border-white/10 px-3 py-2 text-xs text-white rounded-lg outline-none focus:border-[#C9A96E]"
                        >
                            <option value="ALL">جميع الحالات</option>
                            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        {/* Refresh */}
                        <button
                            onClick={() => onRefresh().then(() => push('تم تحديث الطلبات', 'success'))}
                            className="flex items-center gap-1.5 text-[10px] text-[#C9A96E] tracking-widest uppercase hover:text-white transition-colors"
                        >
                            <RefreshCw size={12} /> تحديث
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[10px] tracking-widest uppercase text-white/30 border-b border-white/10 bg-white/[0.02]">
                                {['رقم الطلب', 'العميل', 'الهاتف', 'المدينة', 'المبلغ', 'الحالة', 'التاريخ', 'إجراءات'].map(h => (
                                    <th key={h} className="text-right py-3 px-4 font-normal">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filtered.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-16 text-white/30 text-xs">لا توجد طلبات</td></tr>
                            ) : filtered.map(o => (
                                <tr key={o.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="py-3 px-4">
                                        <span className="font-mono text-[11px] text-[#C9A96E]">
                                            #{o.id.slice(-6).toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <p className="text-sm text-white/90 font-medium">{o.customerName ?? '—'}</p>
                                    </td>
                                    <td className="py-3 px-4">
                                        {o.customerPhone ? (
                                            <a
                                                href={`https://wa.me/${o.customerPhone.replace(/[^\d]/g, '')}`}
                                                target="_blank" rel="noreferrer"
                                                className="flex items-center gap-1 text-xs text-white/50 hover:text-[#25D366] transition-colors"
                                            >
                                                {o.customerPhone} <ExternalLink size={10} />
                                            </a>
                                        ) : '—'}
                                    </td>
                                    <td className="py-3 px-4 text-xs text-white/50">{o.city ?? '—'}</td>
                                    <td className="py-3 px-4">
                                        <span className="font-mono font-semibold text-white">{o.totalAmount.toFixed(2)}</span>
                                        <span className="text-[10px] text-white/30 ml-1">MAD</span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className={`text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full font-bold ${STATUS_COLORS[o.status] ?? 'bg-white/10 text-white/40'}`}>
                                            {STATUS_LABELS[o.status] ?? o.status}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-[10px] text-white/30" suppressHydrationWarning>
                                        {new Date(o.createdAt).toLocaleString('fr-MA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="py-3 px-4">
                                        {actionButtons(o)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
