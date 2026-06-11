import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteIcon from "@mui/icons-material/Delete";
import {
	Alert,
	Box,
	Button,
	Checkbox,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider,
	FormControl,
	FormControlLabel,
	InputLabel,
	MenuItem,
	Select,
	Stack,
	TextField,
	Typography
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
	createContainer,
	createStatus,
	upsertGrant,
	type ContainerTreeNode,
	type ContainerType,
	type ContainerVisibility,
	type StatusCategory,
	type User
} from "../../api/client";
import { errorMessage } from "../tasks/task-utils";

type ContainerCreateDialogProps = {
	open: boolean;
	parent: ContainerTreeNode | null;
	childType: Exclude<ContainerType, "workspace"> | null;
	currentUserId: string;
	users: User[];
	onClose: () => void;
};

type DefaultStatusDraft = {
	key: "todo" | "in_progress" | "done";
	name: string;
	color: string;
};

type CustomStatusDraft = {
	id: string;
	name: string;
	key: string;
	category: StatusCategory;
	color: string;
};

const defaultStatusDrafts: DefaultStatusDraft[] = [
	{ key: "todo", name: "Todo", color: "#64748b" },
	{ key: "in_progress", name: "In Progress", color: "#2563eb" },
	{ key: "done", name: "Done", color: "#16a34a" }
];

const categories: Array<{ value: StatusCategory; label: string }> = [
	{ value: "todo", label: "Todo" },
	{ value: "in_progress", label: "In progress" },
	{ value: "done", label: "Done" }
];

export function ContainerCreateDialog({
	open,
	parent,
	childType,
	currentUserId,
	users,
	onClose
}: ContainerCreateDialogProps) {
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [visibility, setVisibility] = useState<ContainerVisibility>("public");
	const [accessUserIds, setAccessUserIds] = useState<string[]>([]);
	const [customStatuses, setCustomStatuses] = useState<CustomStatusDraft[]>([]);
	const memberUsers = users.filter((user) => user.role === "member");
	const createMutation = useMutation({
		mutationFn: async () => {
			if (!parent || !childType) {
				throw new Error("A parent container is required.");
			}

			const container = await createContainer(currentUserId, {
				name: name.trim(),
				parentId: parent.id,
				type: childType,
				visibility
			});

			try {
				if (childType === "list") {
					const validCustomStatuses = customStatuses.filter((status) => status.name.trim());

					await Promise.all(
						validCustomStatuses.map((status, index) =>
							createStatus(currentUserId, {
								listId: container.id,
								key: status.key.trim() || slugifyStatusKey(status.name),
								name: status.name.trim(),
								category: status.category,
								color: status.color,
								position: defaultStatusDrafts.length + index
							})
						)
					);
				}

				if (visibility === "private" && accessUserIds.length > 0) {
					await Promise.all(
						accessUserIds.map((userId) =>
							upsertGrant(currentUserId, container.id, userId, "allow")
						)
					);
				}
			} catch (error) {
				void queryClient.invalidateQueries({ queryKey: ["containers", "tree"] });
				throw new Error(
					`Created "${container.name}", but setup could not be completed. ${errorMessage(error, "Please reopen settings and finish setup manually.")}`
				);
			}

			return container;
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["containers", "tree"] });
			setName("");
			setAccessUserIds([]);
			setCustomStatuses([]);
			onClose();
		}
	});

	useEffect(() => {
		if (!open) {
			createMutation.reset();
			setName("");
			setVisibility("public");
			setAccessUserIds([]);
			setCustomStatuses([]);
			return;
		}

		setVisibility(parent?.visibility ?? "public");
		setAccessUserIds([]);
		setCustomStatuses([]);
		createMutation.reset();
	}, [open, parent?.visibility]);

	useEffect(() => {
		if (visibility !== "private") {
			setAccessUserIds([]);
		}
	}, [visibility]);

	if (!parent || !childType) {
		return null;
	}

	function resetError() {
		createMutation.reset();
	}

	function updateCustomStatus(
		id: string,
		patch: Partial<CustomStatusDraft>
	) {
		resetError();
		setCustomStatuses((current) =>
			current.map((status) =>
				status.id === id
					? {
						...status,
						...patch
					}
					: status
			)
		);
	}

	function addCustomStatus() {
		resetError();
		setCustomStatuses((current) => [
			...current,
			{
				id: crypto.randomUUID(),
				name: "",
				key: "",
				category: "todo",
				color: "#64748b"
			}
		]);
	}

	function removeCustomStatus(id: string) {
		resetError();
		setCustomStatuses((current) => current.filter((status) => status.id !== id));
	}

	return (
		<Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
			<DialogTitle>Create {childType}</DialogTitle>
			<DialogContent sx={{ px: 3, py: 2 }}>
				<Stack gap={2}>
					<Typography variant="body2" color="text.secondary">
						Parent: {parent.name}
					</Typography>
					{createMutation.error ? (
						<Alert severity="error" sx={{ borderRadius: 1 }}>
							{errorMessage(createMutation.error, `${childType} could not be created.`)}
						</Alert>
					) : null}
					<TextField
						label="Name"
						value={name}
						onChange={(event) => {
							createMutation.reset();
							setName(event.target.value);
						}}
						size="small"
						fullWidth
						autoFocus
					/>
					<FormControl size="small" fullWidth>
						<InputLabel id="create-container-visibility-label">Visibility</InputLabel>
						<Select
							labelId="create-container-visibility-label"
							label="Visibility"
							value={visibility}
							onChange={(event) => {
								createMutation.reset();
								setVisibility(event.target.value as ContainerVisibility);
							}}
						>
							<MenuItem value="public">Public</MenuItem>
							<MenuItem value="private">Private</MenuItem>
						</Select>
					</FormControl>
					{childType === "list" ? (
						<>
							<Divider />
							<Box>
								<Typography variant="subtitle2" fontWeight={800}>
									Initial statuses
								</Typography>
								<Typography variant="caption" color="text.secondary">
									These standard statuses are created automatically. Add more statuses if this list needs extra workflow stages.
								</Typography>
								<Stack gap={1.25} sx={{ mt: 1.25 }}>
									<Stack direction="row" gap={0.75} flexWrap="wrap">
										{defaultStatusDrafts.map((status) => (
											<Box
												key={status.key}
												sx={{
													alignItems: "center",
													border: "1px solid",
													borderColor: "divider",
													borderRadius: 1,
													display: "inline-flex",
													gap: 0.75,
													px: 1,
													py: 0.5
												}}
											>
												<Box
													sx={{
														bgcolor: status.color,
														borderRadius: "50%",
														height: 9,
														width: 9
													}}
												/>
												<Typography variant="body2" fontWeight={700}>
													{status.name}
												</Typography>
											</Box>
										))}
									</Stack>
									{customStatuses.map((status) => (
										<Box
											key={status.id}
											sx={{
												border: "1px solid",
												borderColor: "divider",
												borderRadius: 1,
												p: 2
											}}
										>
											<Stack gap={1.5}>
												<Stack
													direction="row"
													alignItems="center"
													justifyContent="space-between"
													gap={1}
												>
													<Typography variant="caption" color="text.secondary">
														Status
													</Typography>
													<Button
														size="small"
														color="error"
														startIcon={<DeleteIcon />}
														onClick={() => removeCustomStatus(status.id)}
													>
														Remove
													</Button>
												</Stack>
												<Box
													sx={{
														display: "grid",
														gap: 1.25,
														gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }
													}}
												>
													<TextField
														label="Name"
														value={status.name}
														onChange={(event) => {
															const nextName = event.target.value;
															updateCustomStatus(status.id, {
																name: nextName,
																key: slugifyStatusKey(nextName)
															});
														}}
														size="small"
														fullWidth
													/>
													<TextField
														label="Key"
														value={status.key}
														onChange={(event) =>
															updateCustomStatus(status.id, {
																key: slugifyStatusKey(event.target.value)
															})
														}
														helperText={`Preview: ${status.key || "status_key"}`}
														size="small"
														fullWidth
													/>
												</Box>
												<Box
													sx={{
														display: "grid",
														gap: 1.25,
														gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }
													}}
												>
													<FormControl size="small" fullWidth>
														<InputLabel id={`${status.id}-create-category-label`}>
															Category
														</InputLabel>
														<Select
															labelId={`${status.id}-create-category-label`}
															label="Category"
															value={status.category}
															onChange={(event) =>
																updateCustomStatus(status.id, {
																	category: event.target.value as StatusCategory
																})
															}
														>
															{categories.map((category) => (
																<MenuItem key={category.value} value={category.value}>
																	{category.label}
																</MenuItem>
															))}
														</Select>
													</FormControl>
													<TextField
														label="Color"
														type="color"
														value={status.color}
														onChange={(event) =>
															updateCustomStatus(status.id, {
																color: event.target.value
															})
														}
														size="small"
														InputLabelProps={{ shrink: true }}
														fullWidth
													/>
												</Box>
											</Stack>
										</Box>
									))}
									<Button
										variant="outlined"
										startIcon={<AddCircleOutlineIcon />}
										onClick={addCustomStatus}
									>
										Add status
									</Button>
								</Stack>
							</Box>
						</>
					) : null}
					{visibility === "private" ? (
						<>
							<Divider />
							<Box>
								<Typography variant="subtitle2" fontWeight={800}>
									Initial private access
								</Typography>
								<Typography variant="caption" color="text.secondary">
									Selected users get an allow grant immediately after creation.
								</Typography>
								<Stack sx={{ mt: 1 }}>
									{memberUsers.map((user) => (
										<FormControlLabel
											key={user.id}
											control={
												<Checkbox
													checked={accessUserIds.includes(user.id)}
													onChange={() => {
														createMutation.reset();
														setAccessUserIds((current) =>
															current.includes(user.id)
																? current.filter((id) => id !== user.id)
																: [...current, user.id]
														);
													}}
												/>
											}
											label={`${user.name} (${user.id})`}
										/>
									))}
								</Stack>
							</Box>
						</>
					) : null}
				</Stack>
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2.5 }}>
				<Button onClick={onClose}>Cancel</Button>
				<Button
					variant="contained"
					startIcon={<AddCircleOutlineIcon />}
					disabled={!name.trim() || createMutation.isPending}
					onClick={() => createMutation.mutate()}
				>
					Create
				</Button>
			</DialogActions>
		</Dialog>
	);
}

function slugifyStatusKey(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.slice(0, 80);
}
