import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import {
	Alert,
	Box,
	FormControl,
	InputLabel,
	MenuItem,
	Select,
	Skeleton,
	Stack,
	Typography
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { listUsers } from "../../api/client";
import { useAppUi } from "../../state/app-ui-context";

export function UserSwitcher() {
	const { selectedUserId, setSelectedUserId } = useAppUi();
	const { data: users = [], isError, isLoading, error } = useQuery({
		queryKey: ["users", selectedUserId],
		queryFn: ({ signal }) => listUsers(selectedUserId, signal),
		staleTime: 60_000
	});
	const selectedUser = users.find((user) => user.id === selectedUserId);

	if (isLoading) {
		return (
			<Stack gap={1}>
				<Skeleton variant="rounded" height={40} />
				<Skeleton variant="text" width="70%" />
			</Stack>
		);
	}

	if (isError) {
		return (
			<Alert severity="error" sx={{ borderRadius: 1 }}>
				{error instanceof Error ? error.message : "Users could not be loaded."}
			</Alert>
		);
	}

	return (
		<Stack gap={1}>
			<FormControl size="small" fullWidth>
				<InputLabel id="user-switcher-label">User</InputLabel>
				<Select
					labelId="user-switcher-label"
					label="User"
					SelectDisplayProps={{ "data-testid": "user-switcher" }}
					value={selectedUserId}
					onChange={(event) => setSelectedUserId(event.target.value)}
				>
					{users.map((user) => (
						<MenuItem key={user.id} value={user.id}>
							<Stack direction="row" alignItems="center" gap={1}>
								{user.role === "admin" ? (
									<AdminPanelSettingsOutlinedIcon fontSize="small" />
								) : (
									<PersonOutlineIcon fontSize="small" />
								)}
								<Box>
									<Typography variant="body2" fontWeight={700}>
										{user.name}
									</Typography>
									<Typography
										variant="caption"
										color="text.secondary"
										sx={{ textTransform: "capitalize" }}
									>
										{user.id} · {user.role}
									</Typography>
								</Box>
							</Stack>
						</MenuItem>
					))}
				</Select>
			</FormControl>
			<Typography variant="caption" color="text.secondary">
				Requests are sent with X-User-Id: {selectedUser?.id ?? selectedUserId}
			</Typography>
		</Stack>
	);
}
