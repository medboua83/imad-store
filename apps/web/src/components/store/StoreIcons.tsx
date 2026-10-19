import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };
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
