import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { AppShell } from "./features/app-shell/AppShell";
import { appTheme } from "./features/app-shell/theme";
import { AppUiProvider } from "./state/app-ui-context";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1
		}
	}
});

export function App() {
	return (
		<ThemeProvider theme={appTheme}>
			<CssBaseline />
			<QueryClientProvider client={queryClient}>
				<AppUiProvider>
					<AppShell />
				</AppUiProvider>
			</QueryClientProvider>
		</ThemeProvider>
	);
}
