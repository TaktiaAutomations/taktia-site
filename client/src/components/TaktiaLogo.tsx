/*
 * Logo original da Taktia fielmente recriada em SVG
 * Versão para fundo escuro: "Takt" em branco, "IA" em azul claro (#4a9fd5)
 * Ícone: chevron duplo (>>) - seta traseira branca, seta frontal azul claro
 */

interface TaktiaLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export default function TaktiaLogo({ className = "", size = "md" }: TaktiaLogoProps) {
  const sizes = {
    sm: { width: 120, height: 36 },
    md: { width: 160, height: 44 },
    lg: { width: 200, height: 56 },
  };

  const { width, height } = sizes[size];

  return (
    <svg
      viewBox="0 0 320 80"
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Chevron duplo - seta traseira (branca) */}
      <path
        d="M8 12 L38 40 L8 68 L22 68 L52 40 L22 12 Z"
        fill="white"
        rx="4"
      />
      {/* Chevron duplo - seta frontal (azul claro) */}
      <path
        d="M28 20 L52 40 L28 60 L40 60 L64 40 L40 20 Z"
        fill="#4a9fd5"
        rx="4"
      />
      {/* Texto "Takt" em branco */}
      <text
        x="80"
        y="58"
        fontFamily="'Space Grotesk', sans-serif"
        fontWeight="700"
        fontSize="52"
        fill="white"
        letterSpacing="-1"
      >
        Takt
      </text>
      {/* Texto "IA" em azul claro */}
      <text
        x="228"
        y="58"
        fontFamily="'Space Grotesk', sans-serif"
        fontWeight="700"
        fontSize="52"
        fill="#4a9fd5"
        letterSpacing="-1"
      >
        IA
      </text>
    </svg>
  );
}
