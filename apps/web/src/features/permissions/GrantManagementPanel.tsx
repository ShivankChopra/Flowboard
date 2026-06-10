import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import {
	Alert,
	Button,
	Chip,
	CircularProgress,
	Stack,
	Typography
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	deleteGrant,
	listGrants,
	upsertGrant,
	type ContainerTreeNode,
	type GrantMode,
	type User
} from "../../api/client";
import { errorMessage } from "../tasks/task-utils";

type GrantManagementPanelProps = {
	container: ContainerTreeNode;
	currentUserId: string;
	users: User[];
};

export function GrantManagementPanel({
	container,
	currentUserId,
	users
}: GrantManagementPanelProps) {
	const queryClient = useQueryClient();
	const grantsQuery = useQuery({
		queryKey: ["containers", "grants", currentUserId, container.id],
		queryFn: ({ signal }) => listGrants(currentUserId, container.id, signal),
		staleTime: 10_000
	});
	const targetUsers = users.filter((user) => user.role === "member");
	const invalidateGrantsAndTrees = () => {
		void queryClient.invalidateQueries({
			queryKey: ["containers", "grants", currentUserId, container.id]
		});
		void queryClient.invalidateQueries({ queryKey: ["containers", "tree"] });
	};
	const upsertMutation = useMutation({
		mutationFn: ({ userId, mode }: { userId: string; mode: GrantMode }) =>
			upsertGrant(currentUserId, container.id, userId, mode),
		onSuccess: invalidateGrantsAndTrees
	});
	const deleteMutation = useMutation({
		mutationFn: (userId: string) => deleteGrant(currentUserId, container.id, userId),
		onSuccess: invalidateGrantsAndTrees
	});

	if (grantsQuery.isLoading) {
		return (
			<Stack direction="row" alignItems="center" gap={1}>
				<CircularProgress size={18} />
				<Typography variant="body2" color="text.secondary">
					Loading grants
				</Typography>
			</Stack>
		);
	}

	if (grantsQuery.isError) {
		return (
			<Alert severity="error" sx={{ borderRadius: 1 }}>
				{errorMessage(grantsQuery.error, "Grants could not be loaded.")}
			</Alert>
		);
	}

	const grants = grantsQuery.data ?? [];
	const mutationError = upsertMutation.error ?? deleteMutation.error;

	return (
		<Stack gap={1.25}>
			{mutationError ? (
				<Alert severity="error" sx={{ borderRadius: 1 }}>
					{errorMessage(mutationError, "Grant could not be saved.")}
				</Alert>
			) : null}
			{targetUsers.map((user) => {
				const grant = grants.find((item) => item.userId === user.id);
				const busy =
					upsertMutation.isPending ||
					deleteMutation.isPending ||
					grantsQuery.isFetching;

				return (
					<Stack
						key={user.id}
						direction={{ xs: "column", sm: "row" }}
						alignItems={{ xs: "stretch", sm: "center" }}
						justifyContent="space-between"
						gap={1}
						sx={{
							border: "1px solid",
							borderColor: "divider",
							borderRadius: 1,
							p: 1
						}}
					>
						<Stack direction="row" alignItems="center" gap={1}>
							<Typography variant="body2" fontWeight={800}>
								{user.name}
							</Typography>
							<Chip
								size="small"
								label={grant?.mode ?? "inherit"}
								color={grant?.mode === "deny" ? "error" : grant?.mode === "allow" ? "success" : "default"}
								variant={grant ? "filled" : "outlined"}
							/>
						</Stack>
						<Stack direction="row" gap={0.75} flexWrap="wrap">
							<Button
								size="small"
								startIcon={<CheckCircleOutlineIcon />}
								disabled={busy}
								onClick={() => upsertMutation.mutate({ userId: user.id, mode: "allow" })}
							>
								Allow
							</Button>
							<Button
								size="small"
								color="error"
								startIcon={<BlockOutlinedIcon />}
								disabled={busy}
								onClick={() => upsertMutation.mutate({ userId: user.id, mode: "deny" })}
							>
								Deny
							</Button>
							<Button
								size="small"
								startIcon={<RemoveCircleOutlineIcon />}
								disabled={busy || !grant}
								onClick={() => deleteMutation.mutate(user.id)}
							>
								Clear
							</Button>
						</Stack>
					</Stack>
				);
			})}
		</Stack>
	);
}
