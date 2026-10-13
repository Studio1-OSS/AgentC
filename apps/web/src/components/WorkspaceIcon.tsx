import type { SVGProps } from "react";

export type WorkspaceIconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

/**
 * Modern IDE & Cloud Workspace Icon
 * Displays a multi-panel workspace environment (header, sidebar, and editor pane).
 */
export function WorkspaceIcon({ size = 18, className = "", ...props }: WorkspaceIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx="3" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}
