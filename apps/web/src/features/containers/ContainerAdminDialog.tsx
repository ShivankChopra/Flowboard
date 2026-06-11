import ArchiveIcon from "@mui/icons-material/Archive";
import DeleteIcon from "@mui/icons-material/Delete";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import UnarchiveOutlinedIcon from "@mui/icons-material/UnarchiveOutlined";
import {
	Alert,
	Box,
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider,
	FormControl,
	InputLabel,
	MenuItem,
	Select,
	Stack,
	TextField,
	Typography
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
	archiveContainer,
	deleteContainer,
	updateContainer,
	type ContainerTreeNode,
	type ContainerVisibility,
	type User
} from "../../api/client";
import { useAppUi } from "../../state/app-ui-context";
import { GrantManagementPanel } from "../permissions/GrantManagementPanel";
import { StatusSettingsPanel } from "../statuses/StatusSettingsPanel";
import { errorMessage } from "../tasks/task-utils";

type ContainerAdminDialogProps = {
	open: boolean;
	container: ContainerTreeNode | null;
	currentUserId: string;
	users: User[];
	onClose: () => void;
};

type ConfirmAction = "archive" | "delete" | null;

const typeLabel: Record<ContainerTreeNode["type"], string> = {
	workspace: "Workspace",
	space: "Space",
	folder: "Folder",
	list: "List"
};

export function ContainerAdminDialog({
	open,
	container,
	currentUserId,
	users,
	onClose
}: ContainerAdminDialogProps) {
	const queryClient = useQueryClient();
	const { selectedListId, setSelectedListId } = useAppUi();
	const [name, setName] = useState("");
	const [visibility, setVisibility] = useState<ContainerVisibility>("public");
	const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

	useEffect(() => {
		if (!open || !container) {
			return;
		}

		setName(container.name);
		setVisibility(container.visibility);
		setConfirmAction(null);
	}, [container, open]);

	const refreshContainers = () => {
		void queryClient.invalidateQueries({ queryKey: ["containers", "tree"] });
	};
	const updateMutation = useMutation({
		mutationFn: () => {
			if (!container) {
				throw new Error("Container is required.");
			}

			return updateContainer(currentUserId, container.id, {
				name: name.trim(),
				visibility
			});
		},
		onSuccess: refreshContainers
	});
	const archiveMutation = useMutation({
		mutationFn: () => {
			if (!container) {
				throw new Error("Container is required.");
			}

			return archiveContainer(currentUserId, container.id, true);
		},
		onSuccess: () => {
			if (container?.id === selectedListId) {
				setSelectedListId(null);
			}

			setConfirmAction(null);
			onClose();
			refreshContainers();
		}
	});
	const restoreMutation = useMutation({
		mutationFn: () => {
			if (!container) {
				throw new Error("Container is required.");
			}

			return archiveContainer(currentUserId, container.id, false);
		},
		onSuccess: () => {
			setConfirmAction(null);
			refreshContainers();
		}
	});
	const deleteMutation = useMutation({
		mutationFn: () => {
			if (!container) {
				throw new Error("Container is required.");
			}

			return deleteContainer(currentUserId, container.id);
		},
		onSuccess: () => {
			if (container?.id === selectedListId) {
				setSelectedListId(null);
			}

			setConfirmAction(null);
			onClose();
			refreshContainers();
		}
	});

	function resetMutations() {
		updateMutation.reset();
		archiveMutation.reset();
		restoreMutation.reset();
		deleteMutation.reset();
	}

	useEffect(() => {
		resetMutations();
	}, [container?.id, open]);

	const mutationError = useMemo(
		() =>
			updateMutation.error ??
			archiveMutation.error ??
			restoreMutation.error ??
			deleteMutation.error,
		[
			archiveMutation.error,
			deleteMutation.error,
			restoreMutation.error,
			updateMutation.error
		]
	);

	if (!container) {
		return null;
	}

	const busy =
		updateMutation.isPending ||
		archiveMutation.isPending ||
		restoreMutation.isPending ||
		deleteMutation.isPending;
	const canDeleteOrArchive = container.type !== "workspace";
	const hasEditChanges =
		name.trim() !== container.name || visibility !== container.visibility;
	const label = typeLabel[container.type];

	return (
		<>
			<Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
				<DialogTitle>{label} settings: {container.name}</DialogTitle>
				<DialogContent>
					<Stack gap={2.25} sx={{ pt: 0.5 }}>
						{mutationError ? (
							<Alert severity="error" sx={{ borderRadius: 1 }}>
								{errorMessage(mutationError, `${label} change could not be saved.`)}
							</Alert>
						) : null}

						<Stack gap={1}>
							<Stack direction="row" alignItems="center" gap={1}>
								<FolderOutlinedIcon color="primary" fontSize="small" />
								<Typography variant="subtitle2" fontWeight={800}>
									{label} details
								</Typography>
							</Stack>
							<Stack direction={{ xs: "column", sm: "row" }} gap={1}>
								<TextField
									label="Name"
									value={name}
									onChange={(event) => {
										resetMutations();
										setName(event.target.value);
									}}
									size="small"
									fullWidth
								/>
								<FormControl size="small" fullWidth>
									<InputLabel id="container-visibility-label">Visibility</InputLabel>
									<Select
										labelId="container-visibility-label"
										label="Visibility"
										value={visibility}
										onChange={(event) => {
											resetMutations();
											setVisibility(event.target.value as ContainerVisibility);
										}}
									>
										<MenuItem value="public">Public</MenuItem>
										<MenuItem value="private">Private</MenuItem>
									</Select>
								</FormControl>
								<Button
									variant="contained"
									startIcon={<SaveOutlinedIcon />}
									disabled={busy || !name.trim() || !hasEditChanges}
									onClick={() => updateMutation.mutate()}
									sx={{ minWidth: 112 }}
								>
									Save
								</Button>
							</Stack>
							<Typography variant="caption" color="text.secondary">
								Private visibility cascades to descendants. Public visibility is rejected under private ancestors.
							</Typography>
						</Stack>

						<Divider />
						<Stack gap={1}>
							<Stack direction="row" alignItems="center" gap={1}>
								<GroupOutlinedIcon color="primary" fontSize="small" />
								<Typography variant="subtitle2" fontWeight={800}>
									Permissions
								</Typography>
							</Stack>
							<GrantManagementPanel
								container={container}
								currentUserId={currentUserId}
								users={users}
							/>
						</Stack>

						{container.type === "list" ? (
							<>
								<Divider />
								<Stack gap={1}>
									<Stack direction="row" alignItems="center" gap={1}>
										<TuneOutlinedIcon color="primary" fontSize="small" />
										<Typography variant="subtitle2" fontWeight={800}>
											Statuses
										</Typography>
									</Stack>
									<StatusSettingsPanel
										currentUserId={currentUserId}
										listId={container.id}
									/>
								</Stack>
							</>
						) : null}

						<Divider />
						<Box>
							<Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
								Danger zone
							</Typography>
							<Stack direction="row" gap={1} flexWrap="wrap">
								{container.isArchived ? (
									<Button
										color="success"
										startIcon={<UnarchiveOutlinedIcon />}
										disabled={busy || !canDeleteOrArchive}
										onClick={() => {
											resetMutations();
											restoreMutation.mutate();
										}}
									>
										Restore
									</Button>
								) : (
									<Button
										color="warning"
										startIcon={<ArchiveIcon />}
										disabled={busy || !canDeleteOrArchive}
										onClick={() => {
											resetMutations();
											setConfirmAction("archive");
										}}
									>
										Archive
									</Button>
								)}
								<Button
									color="error"
									startIcon={<DeleteIcon />}
									disabled={busy || !canDeleteOrArchive}
									onClick={() => {
										resetMutations();
										setConfirmAction("delete");
									}}
								>
									Delete
								</Button>
							</Stack>
						</Box>
					</Stack>
				</DialogContent>
				<DialogActions>
					<Button
						onClick={() => {
							resetMutations();
							onClose();
						}}
					>
						Close
					</Button>
				</DialogActions>
			</Dialog>

			<Dialog open={Boolean(confirmAction)} onClose={() => setConfirmAction(null)}>
				<DialogTitle>
					{confirmAction === "archive" ? "Archive container" : "Delete container"}
				</DialogTitle>
				<DialogContent>
					<Typography>
						{confirmAction === "archive"
							? `Archive "${container.name}" and its descendants?`
							: `Hard-delete "${container.name}"? The backend only allows empty containers to be deleted.`}
					</Typography>
				</DialogContent>
				<DialogActions>
					<Button
						onClick={() => {
							resetMutations();
							setConfirmAction(null);
						}}
					>
						Cancel
					</Button>
					<Button
						color={confirmAction === "archive" ? "warning" : "error"}
						variant="contained"
						disabled={busy}
						onClick={() => {
							resetMutations();

							if (confirmAction === "archive") {
								archiveMutation.mutate();
							} else if (confirmAction === "delete") {
								deleteMutation.mutate();
							}
						}}
					>
						{confirmAction === "archive" ? "Archive" : "Delete"}
					</Button>
				</DialogActions>
			</Dialog>
		</>
	);
}
