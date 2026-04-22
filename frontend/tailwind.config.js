/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      "colors": {
        "on-error": "#690005",
        "tertiary-container": "#eae0dd",
        "on-tertiary-container": "#696360",
        "on-tertiary-fixed": "#1f1b19",
        "primary": "#ffffff",
        "on-surface": "#e5e2e1",
        "surface-container-lowest": "#0e0e0e",
        "on-tertiary": "#342f2d",
        "on-secondary-container": "#b0b2ff",
        "on-secondary-fixed-variant": "#2f2ebe",
        "on-secondary-fixed": "#07006c",
        "on-background": "#e5e2e1",
        "secondary-container": "#3131c0",
        "on-secondary": "#1000a9",
        "primary-fixed": "#e2e2e2",
        "tertiary-fixed-dim": "#cec4c2",
        "secondary": "#c0c1ff",
        "on-surface-variant": "#c4c7c8",
        "secondary-fixed-dim": "#c0c1ff",
        "tertiary-fixed": "#eae0dd",
        "secondary-fixed": "#e1e0ff",
        "surface-dim": "#131313",
        "on-primary": "#2f3131",
        "inverse-primary": "#5d5f5f",
        "inverse-surface": "#e5e2e1",
        "surface-container-low": "#1c1b1b",
        "inverse-on-surface": "#313030",
        "error-container": "#93000a",
        "on-primary-fixed": "#1a1c1c",
        "tertiary": "#fffeff",
        "surface-variant": "#353534",
        "on-error-container": "#ffdad6",
        "on-tertiary-fixed-variant": "#4b4543",
        "surface-container": "#201f1f",
        "surface-bright": "#3a3939",
        "surface-tint": "#c6c6c6",
        "primary-container": "#e2e2e2",
        "surface": "#131313",
        "primary-fixed-dim": "#c6c6c6",
        "on-primary-fixed-variant": "#454747",
        "surface-container-highest": "#353534",
        "error": "#ffb4ab",
        "surface-container-high": "#2a2a2a",
        "outline-variant": "#444748",
        "background": "#000000",
        "on-primary-container": "#636465",
        "outline": "#8e9192"
      },
      "borderRadius": {
        "DEFAULT": "1rem",
        "lg": "2rem",
        "xl": "3rem",
        "full": "9999px"
      },
      "spacing": {
        "xl": "48px",
        "gutter": "16px",
        "lg": "32px",
        "xs": "8px",
        "margin": "20px",
        "md": "20px",
        "base": "4px",
        "sm": "12px"
      },
      "fontFamily": {
        "display-lg": ["Outfit", "Inter", "sans-serif"],
        "label-caps": ["Inter", "sans-serif"],
        "body-rt": ["Inter", "sans-serif"],
        "title-sm": ["Inter", "sans-serif"],
        "headline-md": ["Outfit", "Inter", "sans-serif"],
        "mono": ["JetBrains Mono", "monospace"]
      },
      "fontSize": {
        "display-lg": ["32px", {"lineHeight": "1.2", "letterSpacing": "-0.02em", "fontWeight": "600"}],
        "label-caps": ["12px", {"lineHeight": "1.0", "letterSpacing": "0.05em", "fontWeight": "600"}],
        "body-rt": ["16px", {"lineHeight": "1.6", "letterSpacing": "0em", "fontWeight": "400"}],
        "title-sm": ["18px", {"lineHeight": "1.4", "letterSpacing": "0em", "fontWeight": "500"}],
        "headline-md": ["24px", {"lineHeight": "1.3", "letterSpacing": "-0.01em", "fontWeight": "600"}]
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ],
}
