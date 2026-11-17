import React from "react";

// OpenStock logo SVG (inline approximation)
const OpenStockLogoSVG: React.FC<{ size?: number }> = ({ size = 26 }) => (
    <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
    >
        <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="4" />
        <path
            d="M100 30 Q130 30 130 60 Q130 90 100 90 Q70 90 70 60 Q70 30 100 30"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
        />
    </svg>
);

type OpenStockBrandingProps = {
    text?: string;
    name?: string;
    style?: React.CSSProperties;
    className?: string;
    logoSize?: number;
    textColor?: string;
    outerStyle?: React.CSSProperties;
    outerClassName?: string;
};

export const OpenStockBranding: React.FC<OpenStockBrandingProps> = ({
    text = "OpenStock",
    name = "Hakan Borsa Analizi",
    style = {},
    className = "rounded-lg px-3 py-0.5 shadow-[inset_0_0_0_1px_var(--line)]",
    logoSize = 40,
    textColor = "#fff",
    outerStyle = {},
    outerClassName = "",
}) => (
    <div
        className={outerClassName}
        style={{
            ...outerStyle,
        }}
    >
        <div
            className={className}
            style={{
                textAlign: "center",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.2em",
                background: "none",
                ...style,
            }}
        >
            <OpenStockLogoSVG size={logoSize} />
            <span
                style={{
                    color: textColor,
                    fontWeight: "600",
                    fontSize: "0.875rem",
                    ...style,
                }}
            >
                {text} {name}
            </span>
        </div>
    </div>
);

export default OpenStockBranding;