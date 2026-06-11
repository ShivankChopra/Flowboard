import { createTheme } from "@mui/material";

export const appTheme = createTheme({
	palette: {
		mode: "light",
		primary: {
			main: "#2563eb"
		},
		background: {
			default: "#edeff1",
			paper: "#ffffff"
		},
		text: {
			primary: "#111827",
			secondary: "#5f6b7a"
		},
		divider: "#d8e2ec"
	},
	typography: {
		fontFamily: [
			"Inter",
			"-apple-system",
			"BlinkMacSystemFont",
			"Segoe UI",
			"sans-serif"
		].join(","),
		h5: {
			fontSize: "1.25rem",
			fontWeight: 700
		},
		h6: {
			fontSize: "1rem",
			fontWeight: 700
		}
	},
	shape: {
		borderRadius: 8
	},
	components: {
		MuiButtonBase: {
			defaultProps: {
				disableRipple: true
			}
		},
		MuiChip: {
			styleOverrides: {
				root: {
					borderRadius: 6,
					fontWeight: 600
				}
			}
		}
	}
});
