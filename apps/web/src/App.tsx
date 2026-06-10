import { Box, CssBaseline, ThemeProvider, Typography, createTheme } from "@mui/material";

const theme = createTheme({
	palette: {
		mode: "light",
		primary: {
			main: "#2563eb"
		},
		background: {
			default: "#f8fafc"
		}
	},
	typography: {
		fontFamily: [
			"Inter",
			"-apple-system",
			"BlinkMacSystemFont",
			"Segoe UI",
			"sans-serif"
		].join(",")
	},
	shape: {
		borderRadius: 8
	}
});

export function App() {
	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<Box
				sx={{
					minHeight: "100vh",
					display: "grid",
					gridTemplateColumns: "280px 1fr",
					bgcolor: "background.default"
				}}
			>
				<Box
					component="aside"
					sx={{
						borderRight: "1px solid",
						borderColor: "divider",
						bgcolor: "background.paper",
						p: 3
					}}
				>
					<Typography variant="h6" component="h1">
						Flowboard
					</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
						Phase 0 shell
					</Typography>
				</Box>
				<Box component="main" sx={{ p: 4 }}>
					<Typography variant="h4" component="h2">
						Project workspace
					</Typography>
					<Typography color="text.secondary" sx={{ mt: 1 }}>
						The API, database, and web app scaffolding are ready for the next phase.
					</Typography>
				</Box>
			</Box>
		</ThemeProvider>
	);
}
