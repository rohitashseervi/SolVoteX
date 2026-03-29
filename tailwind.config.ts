import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        saffron: "#FF9933",
        "indian-green": "#138808",
        "navy-blue": "#06038D",
        "chakra-blue": "#4169e1",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(255, 153, 51, 0.4)" },
          "100%": { boxShadow: "0 0 20px rgba(255, 153, 51, 0.8)" },
        },
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        solvotex: {
          primary: "#FF9933",
          secondary: "#138808",
          accent: "#4169e1",
          neutral: "#0a0a1a",
          "base-100": "#0d0d1f",
          "base-200": "#12122a",
          "base-300": "#1a1a35",
          info: "#4169e1",
          success: "#138808",
          warning: "#FF9933",
          error: "#dc2626",
        },
      },
    ],
  },
};

export default config;
