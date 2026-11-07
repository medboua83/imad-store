"use client";
import { useEffect, useRef, useState } from "react";
import { canonicalShippingCity, searchShippingCities, shippingCityLabel } from "@imad-store/shared";
import { Check, ChevronDown, MapPin } from "lucide-react";

export function CheckoutCityInput({
    value,
    onChange,
    onBlur,
    disabled,
    invalid,
    describedBy,
}: {
    value: string;
    onChange: (value: string) => void;
    onBlur: () => void;
    disabled: boolean;
    invalid: boolean;
    describedBy?: string;
}) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const root = useRef<HTMLDivElement>(null);
    const [layout, setLayout] = useState({ above: false, maxHeight: 220 });
    const results = searchShippingCities(value);
    const popular = [
        "casablanca",
        "tangier",
        "rabat",
        "marrakech",
        "fes",
        "agadir",
        "tetouan",
        "kenitra",
    ];
    const options = (
        value.trim() ? results : popular.filter((city) => results.includes(city))
    ).slice(0, 8);
    const expanded = open && !disabled;
    function choose(city: string) {
        onChange(shippingCityLabel(city));
        setOpen(false);
        setActive(-1);
    }
    useEffect(() => {
        if (!expanded) return;
        const update = () => {
            const input = root.current?.querySelector("input");
            if (!input) return;
            const rect = input.getBoundingClientRect();
            const viewport = window.visualViewport;
            const top = viewport?.offsetTop || 0;
            const bottom = top + (viewport?.height || innerHeight);
            const header = document.querySelector("header")?.getBoundingClientRect();
            const submit = document.querySelector(".checkout-submit-bar");
            const footerTop =
                submit && getComputedStyle(submit).position === "fixed"
                    ? submit.getBoundingClientRect().top
                    : bottom;
            const below = Math.min(bottom, footerTop) - rect.bottom - 12;
            const above = rect.top - Math.max(top, header?.bottom || top) - 12;
            const desired = Math.min(options.length * 48 || 64, 220) + 12;
            const useAbove = below < desired && above > below;
            const maxHeight = Math.max(44, Math.min(220, (useAbove ? above : below) - 12));
            setLayout((old) =>
                old.above === useAbove && old.maxHeight === maxHeight
                    ? old
                    : { above: useAbove, maxHeight },
            );
        };
        update();
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        window.visualViewport?.addEventListener("resize", update);
        window.visualViewport?.addEventListener("scroll", update);
        return () => {
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update, true);
            window.visualViewport?.removeEventListener("resize", update);
            window.visualViewport?.removeEventListener("scroll", update);
        };
    }, [expanded, options.length]);
    useEffect(() => {
        if (!expanded || active < 0) return;
        const index = active;
        // Scroll the list itself, keeping the page and the typing position stable.
        const row = root.current?.querySelector<HTMLElement>(`#checkout-city-option-${index}`);
        const list = root.current?.querySelector<HTMLElement>("[role=listbox]");
        if (row && list) {
            if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
            else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight)
                list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
        }
    }, [active, expanded, layout.maxHeight, layout.above]);
    return (
        <div className="checkout-city-picker" ref={root}>
            <div className="checkout-city-control">
                <MapPin size={18} aria-hidden="true" />
                <input
                    id="checkout-city"
                    name="city"
                    role="combobox"
                    type="text"
                    autoComplete="address-level2"
                    className="store-input"
                    required
                    disabled={disabled}
                    value={value}
                    maxLength={80}
                    placeholder="ابحثوا عن مدينتكم…"
                    spellCheck={false}
                    dir="auto"
                    aria-invalid={invalid}
                    aria-expanded={expanded}
                    aria-autocomplete="list"
                    aria-controls="checkout-city-options"
                    aria-describedby={[describedBy, "city-search-results"]
                        .filter(Boolean)
                        .join(" ")}
                    aria-activedescendant={
                        expanded && active >= 0 && options[active]
                            ? `checkout-city-option-${active}`
                            : undefined
                    }
                    onChange={(e) => {
                        onChange(e.target.value);
                        setActive(-1);
                        setOpen(true);
                    }}
                    onFocus={() => {
                        setOpen(true);
                        setActive(-1);
                    }}
                    onClick={() => setOpen(true)}
                    onBlur={() => {
                        setOpen(false);
                        setActive(-1);
                        onBlur();
                    }}
                    onKeyDown={(e) => {
                        if (e.nativeEvent.isComposing) return;
                        if (e.key === "Escape") {
                            e.preventDefault();
                            setOpen(false);
                            setActive(-1);
                        }
                        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                            e.preventDefault();
                            setOpen(true);
                            if (options.length)
                                setActive(
                                    e.key === "ArrowDown"
                                        ? (active + 1) % options.length
                                        : active <= 0
                                          ? options.length - 1
                                          : active - 1,
                                );
                        }
                        if (e.key === "Enter") {
                            e.preventDefault();
                            if (expanded && options.length)
                                choose(options[active >= 0 ? active : 0]);
                        }
                    }}
                />
                {canonicalShippingCity(value) ? (
                    <Check size={17} aria-hidden="true" />
                ) : (
                    <ChevronDown size={17} aria-hidden="true" />
                )}
            </div>
            {expanded && (
                <div className={`checkout-city-menu ${layout.above ? "is-above" : ""}`}>
                    <ul
                        id="checkout-city-options"
                        role="listbox"
                        aria-label="مدن التوصيل"
                        style={{ maxHeight: layout.maxHeight }}
                    >
                        {options.map((city, index) => (
                            <li
                                key={city}
                                id={`checkout-city-option-${index}`}
                                role="option"
                                aria-selected={active === index}
                                className={active === index ? "is-active" : ""}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => choose(city)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        choose(city);
                                    }
                                }}
                            >
                                <span>{shippingCityLabel(city)}</span>
                                <bdi dir="ltr">
                                    {city.replace(/\b\p{L}/gu, (c) => c.toUpperCase())}
                                </bdi>
                            </li>
                        ))}
                    </ul>
                    {!options.length && (
                        <p className="checkout-city-empty">
                            لا توجد نتيجة. جرّبوا اسماً آخر للمدينة.
                        </p>
                    )}
                </div>
            )}
            <p id="city-search-results" className="checkout-hint" role="status">
                {expanded && value.trim() && !results.length
                    ? "لا توجد نتيجة. غيّروا اسم المدينة للمتابعة."
                    : "ابحثوا بالعربية أو الفرنسية واختاروا المدينة مباشرة."}
            </p>
        </div>
    );
}
