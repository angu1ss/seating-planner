export const LOCK_BODY =
  "M4.2 7 H11.8 A1 1 0 0 1 12.8 8 V14 A1 1 0 0 1 11.8 15 H4.2 A1 1 0 0 1 3.2 14 V8 A1 1 0 0 1 4.2 7 Z";
export const LOCK_SHACKLE_CLOSED = "M5 7 V5.5 A2.5 2.5 0 0 1 11 5.5 V7";
export const LOCK_SHACKLE_OPEN = "M5 7 V5.5 A2.5 2.5 0 0 1 10.6 4.2";

interface IconProps {
  size?: number;
  open?: boolean;
}

export function LockIcon({ size = 16, open = false }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={LOCK_BODY} />
      <path d={open ? LOCK_SHACKLE_OPEN : LOCK_SHACKLE_CLOSED} />
    </svg>
  );
}
