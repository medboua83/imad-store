import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };
/** Decorative, local SVGs: labels belong to the surrounding link. */
export function CategoryIcon({ slug, size = 40, ...props }: IconProps & { slug: string }) {
    const drawings: Record<string, React.ReactNode> = {
        abayas: (
            <>
                <path d="m17 7-8 6 5 10 4-3-3 27h26l-3-27 4 3 5-10-8-6" />
                <path d="M17 7c2 7 12 7 14 0M24 14v33M19 31h10" />
            </>
        ),
        shawls: (
            <>
                <path d="M12 8h23l-4 21 8 15H15l-5-15z" />
                <path d="m17 8-2 21 5 15M15 29h16M19 44v4m5-4v4m5-4v4m5-4v4" />
            </>
        ),
        bags: (
            <>
                <path d="M11 19h26l3 26H8z" />
                <path d="M17 20v-6a7 7 0 0 1 14 0v6M18 29h12" />
                <circle cx="17" cy="23" r="1" />
                <circle cx="31" cy="23" r="1" />
            </>
        ),
        "womens-shoes": (
            <>
                <path d="m9 19 7 3c5 2 8 9 13 10l12 3v7H7v-9z" />
                <path d="m10 21 3-9 8 5-5 5M8 37h33M10 42v5m28-5v5" />
            </>
        ),
        "mens-clogs": (
            <>
                <path d="M8 33c1-10 6-16 14-16h10l2 12 9 6v8H6v-6z" />
                <path d="M8 37h35M13 25h20M17 19l3 7m4-9 3 9" />
            </>
        ),
    };
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 48 56"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            {...props}
        >
            {drawings[slug] || (
                <>
                    <path d="m8 17 16-8 16 8v25H8zM8 17l16 9 16-9M24 26v16" />
                </>
            )}
        </svg>
    );
}

export function SocialIcon({ network, size = 21, ...props }: IconProps & { network: string }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            {...props}
        >
            {network === "Instagram" ? (
                <>
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" />
                </>
            ) : network === "Facebook" ? (
                <path
                    fill="currentColor"
                    stroke="none"
                    d="M14 22v-9h3l.5-4H14V7c0-1.2.5-2 2-2h2V1.5c-.7-.1-1.7-.2-3-.2-3.2 0-5 2-5 5.3V9H7v4h3v9z"
                />
            ) : network === "TikTok" ? (
                <path d="M14 3v12a4.5 4.5 0 1 1-4-4.5v3a1.5 1.5 0 1 0 1 1.5V3h3c.5 3 2.5 4.5 5 4.5v3c-2 0-3.5-.8-5-2" />
            ) : (
                <>
                    <path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.3-4.7A8.5 8.5 0 1 1 20.5 11.5Z" />
                    <path d="m8 7 2 3-1 1c1 2 2 3 4 4l1-1 3 1c0 2-2 3-4 2-4-1-7-4-7-7 0-2 1-3 2-3Z" />
                </>
            )}
        </svg>
    );
}
