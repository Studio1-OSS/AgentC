import type { SVGProps } from "react";

export type TokenFactoryLogoProps = SVGProps<SVGSVGElement> & {
  variant?: "full" | "icon";
};

const NEBIUS_PATH =
  "M86.239 7.34c2.876.034 7.358.557 7.618 4.178H90.98c-.255-1.834-4.319-1.894-6.396-1.686-.024.001-2.503.105-2.503 1.342-.003.019-.157 1.124 2.299 1.352.277.026 3.894.326 4.153.348l.192.02c2.103.215 3.204.33 4.489 1.362h-.003l-.001.003c1.323 1.15 1.535 3.709-.478 5.028-1.824 1.17-4.108 1.316-6.214 1.367-3.093 0-7.522-.603-7.517-4.5h2.844c.09.916.628 1.466 1.564 1.735 1.109.31 2.18.349 3.232.356 2.4 0 4.74-.393 4.59-1.752-.138-1.233-1.78-1.359-2.554-1.418l-.07-.005c-.496-.038-2.8-.18-2.815-.18a29.845 29.845 0 0 1-3.154-.381c-1.405-.263-2.091-.8-2.541-1.194-1.159-1.09-1.339-3.52.509-4.74 1.648-1.074 3.727-1.188 5.632-1.235Zm-73.88.009c1.246 0 2.126.69 2.663 1.919l3.29 7.591c.832 1.918 2.404 1.702 2.404 1.702 0 1.081-.85 2.092-2.098 2.092-1.247 0-2.126-.691-2.664-1.920l-3.289-7.59C11.832 9.224 10.26 9.44 10.26 9.44c0-1.082.851-2.092 2.097-2.092Zm53.638.182v6.88c0 2.4 1.502 3.82 4.09 3.82 2.59 0 4.114-1.42 4.114-3.820V7.53h2.61v6.84c0 3.798-2.673 6.281-6.723 6.281s-6.7-2.503-6.7-6.282V7.53h2.61Zm-16.244 0c2.247.014 5.127.523 5.127 3.528 0 1.319-.584 2.21-1.288 2.675l-.001.001c.702.21 2.097 1.2 2.097 3.069 0 2.176-1.265 3.662-5.146 3.662v-.004H42.13V7.53h7.622ZM39.44 9.976H28.646v2.786h9.623v2.445h-9.623v2.808H39.44v2.446H26.014V7.53H39.44v2.445ZM60.696 20.46h-2.631V7.53h2.631v12.93ZM10.26 20.46H7.647V12.6c0-3 2.613-3.16 2.613-3.16v11.02Zm13.067-5.06c0 2.984-2.584 3.158-2.613 3.16V7.54h2.613v7.86Zm21.434 2.615 5.816-.001c1.217-.001 2.39-.197 2.39-1.430 0-1.233-1.294-1.468-2.427-1.468v-.007h-5.78v2.906Zm0-5.198h5.817c.713-.006 1.774-.236 1.774-1.328 0-1.091-.927-1.516-2.134-1.516h-5.456v2.844Z";

const ICON_PATH =
  "M115.202 5.696c.301 0 .544.244.544.544V8.63c0 .214.173.389.388.389h2.389c.301 0 .544.243.544.544v2.388a.39.39 0 0 0 .389.389h2.389c.301 0 .545.244.545.545v2.233a.546.546 0 0 1-.545.544h-2.389a.39.39 0 0 0-.389.389v2.389c0 .3-.243.543-.544.543h-2.389a.389.389 0 0 0-.388.39v2.388c0 .3-.243.543-.544.544h-2.233a.543.543 0 0 1-.544-.544v-2.234c0-.3.243-.544.544-.544h2.388a.389.389 0 0 0 .389-.388v-2.389c0-.3.243-.544.544-.544h2.39a.388.388 0 0 0 .387-.388v-2.544a.389.389 0 0 0-.387-.39h-2.390a.543.543 0 0 1-.544-.544V9.406a.389.389 0 0 0-.389-.388h-2.388a.543.543 0 0 1-.544-.544V6.24c0-.3.243-.544.544-.544h2.233Z";

const svgStyle = { display: "inline-block", verticalAlign: "middle", flexShrink: 0 } as const;

export function TokenFactoryLogo({
  variant = "full",
  className = "",
  style,
  height = 14,
  ...props
}: TokenFactoryLogoProps) {
  const classes = `token-factory-logo-svg ${className}`.trim();
  const h = Number(height);

  const icon = (
    <svg
      viewBox="111.5 5 11 18"
      height={h}
      width={h * (11 / 18)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={variant === "icon" ? classes : "token-factory-logo-svg"}
      style={{ ...svgStyle, ...(variant === "icon" ? style : null) }}
      aria-label={variant === "icon" ? "Nebius Token Factory" : undefined}
      aria-hidden={variant === "icon" ? undefined : true}
      {...(variant === "icon" ? props : {})}
    >
      <path fill="currentColor" d={ICON_PATH} />
    </svg>
  );

  if (variant === "icon") return icon;

  return (
    <span
      className={`token-factory-logo ${className}`.trim()}
      style={{ display: "inline-flex", alignItems: "center", gap: Math.round(h * 0.45), ...style }}
      aria-label="Nebius"
    >
      {icon}
      <svg
        viewBox="7.4 7.2 87 13.6"
        height={h * 0.72}
        width={h * 0.72 * (87 / 13.6)}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="token-factory-logo-svg"
        style={svgStyle}
        aria-hidden
      >
        <path fill="currentColor" d={NEBIUS_PATH} />
      </svg>
    </span>
  );
}
