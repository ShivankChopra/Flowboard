import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
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
	createContainer,
	deleteContainer,
	updateContainer,
	type ContainerTreeNode,
	type ContainerType,
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

const childTypeByParentType: Partial<Record<ContainerType, Exclude<ContainerType, "workspace">>> = {
	workspace: "space",
	space: "folder",
	folder: "list"
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
	const [newName, setNewName] = useState("");
	const [newVisibility, setNewVisibility] = useState<ContainerVisibility>("public");
	const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
	const childType = container ? childTypeByParentType[container.type] : undefined;

	useEffect(() => {
		if (!open || !container) {
			return;
		}

		setName(container.name);
		setVisibility(container.visibility);
		setNewName("");
		setNewVisibility(container.visibility);
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
	const createMutation = useMutation({
		mutationFn: () => {
			if (!container || !childType) {
				throw new Error("Child containers cannot be created here.");
			}

			return createContainer(currentUserId, {
				name: newName.trim(),
				parentId: container.id,
				type: childType,
				visibility: newVisibility
			});
		},
		onSuccess: () => {
			setNewName("");
			refreshContainers();
		}
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

	const mutationError = useMemo(
		() =>
			updateMutation.error ??
			createMutation.error ??
			archiveMutation.error ??
			deleteMutation.error,
		[
			archiveMutation.error,
			createMutation.error,
			deleteMutation.error,
			updateMutation.error
		]
	);

	if (!container) {
		return null;
	}

	const busy =
		updateMutation.isPending ||
		createMutation.isPending ||
		archiveMutation.isPending ||
		deleteMutation.isPending;
	const canDeleteOrArchive = container.type !== "workspace";
	const hasEditChanges =
		name.trim() !== container.name || visibility !== container.visibility;

	return (
		<>
			<Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
				<DialogTitle>Admin: {container.name}</DialogTitle>
				<DialogContent>
					<Stack gap={2.25} sx={{ pt: 0.5 }}>
						{mutationError ? (
							<Alert severity="error" sx={{ borderRadius: 1 }}>
								{errorMessage(mutationError, "Container change could not be saved.")}
							</Alert>
						) : null}

						<Stack gap={1}>
							<Stack direction="row" alignItems="center" gap={1}>
								<FolderOutlinedIcon color="primary" fontSize="small" />
								<Typography variant="subtitle2" fontWeight={800}>
									Container
								</Typography>
							</Stack>
							<Stack direction={{ xs: "column", sm: "row" }} gap={1}>
								<TextField
									label="Name"
									value={name}
									onChange={(event) => setName(event.target.value)}
									size="small"
									fullWidth
								/>
								<FormControl size="small" fullWidth>
									<InputLabel id="container-visibility-label">Visibility</InputLabel>
									<Select
										labelId="container-visibility-label"
										label="Visibility"
										value={visibility}
										onChange={(event) =>
											setVisibility(event.target.value as ContainerVisibility)
										}
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

						{childType ? (
							<>
								<Divider />
								<Stack gap={1}>
									<Stack direction="row" alignItems="center" gap={1}>
										<AddCircleOutlineIcon color="primary" fontSize="small" />
										<Typography variant="subtitle2" fontWeight={800}>
											Create {childType}
										</Typography>
									</Stack>
									<Stack direction={{ xs: "column", sm: "row" }} gap={1}>
										<TextField
											label="Name"
											value={newName}
											onChange={(event) => setNewName(event.target.value)}
											size="small"
											fullWidth
										/>
										<FormControl size="small" fullWidth>
											<InputLabel id="new-container-visibility-label">Visibility</InputLabel>
											<Select
												labelId="new-container-visibility-label"
												label="Visibility"
												value={newVisibility}
												onChange={(event) =>
													setNewVisibility(event.target.value as ContainerVisibility)
												}
											>
												<MenuItem value="public">Public</MenuItem>
												<MenuItem value="private">Private</MenuItem>
											</Select>
										</FormControl>
										<Button
											variant="contained"
											startIcon={<AddCircleOutlineIcon />}
											disabled={busy || !newName.trim()}
											onClick={() => createMutation.mutate()}
											sx={{ minWidth: 120 }}
										>
											Create
										</Button>
									</Stack>
								</Stack>
							</>
						) : null}

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
								<Button
									color="warning"
									startIcon={<ArchiveOutlinedIcon />}
									disabled={busy || !canDeleteOrArchive}
									onClick={() => setConfirmAction("archive")}
								>
									Archive
								</Button>
								<Button
									color="error"
									startIcon={<DeleteOutlineIcon />}
									disabled={busy || !canDeleteOrArchive}
									onClick={() => setConfirmAction("delete")}
								>
									Delete
								</Button>
							</Stack>
						</Box>
					</Stack>
				</DialogContent>
				<DialogActions>
					<Button onClick={onClose}>Close</Button>
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
					<Button onClick={() => setConfirmAction(null)}>Cancel</Button>
					<Button
						color={confirmAction === "archive" ? "warning" : "error"}
						variant="contained"
						disabled={busy}
						onClick={() => {
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
