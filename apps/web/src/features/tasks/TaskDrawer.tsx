import DeleteIcon from "@mui/icons-material/Delete";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import {
	Alert,
	Box,
	Button,
	Checkbox,
	Divider,
	Drawer,
	FormControl,
	FormControlLabel,
	InputLabel,
	MenuItem,
	Select,
	Stack,
	Tab,
	Tabs,
	TextField,
	Typography,
} from "@mui/material";
import {
	useCallback,
	useEffect,
	useMemo,
	useState,
	type PointerEvent as ReactPointerEvent,
} from "react";
import type {
	Status,
	Task,
	TaskPayload,
	TaskPriority,
	User,
} from "../../api/client";
import { MarkdownPreview } from "./MarkdownPreview";
import {
	dateInputToIso,
	dateInputValue,
	priorityOptions,
	userName,
} from "./task-utils";

type TaskDrawerProps = {
	open: boolean;
	listId: string;
	statuses: Status[];
	users: User[];
	task: Task | null;
	initialStatusId: string | null;
	isSaving: boolean;
	isDeleting: boolean;
	error: string | null;
	onClose: () => void;
	onSubmit: (payload: TaskPayload, taskId: string | null) => void;
	onDelete: (taskId: string) => void;
};

export function TaskDrawer({
	open,
	listId,
	statuses,
	users,
	task,
	initialStatusId,
	isSaving,
	isDeleting,
	error,
	onClose,
	onSubmit,
	onDelete,
}: TaskDrawerProps) {
	const defaultStatusId =
		initialStatusId ?? task?.statusId ?? statuses[0]?.id ?? "";
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [statusId, setStatusId] = useState(defaultStatusId);
	const [priority, setPriority] = useState<TaskPriority>("none");
	const [dueDate, setDueDate] = useState("");
	const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
	const [descriptionTab, setDescriptionTab] = useState<"write" | "preview">(
		"preview",
	);
	const [drawerWidth, setDrawerWidth] = useState(520);
	const mode = task ? "edit" : "create";

	useEffect(() => {
		if (!open) {
			return;
		}

		setTitle(task?.title ?? "");
		setDescription(task?.description ?? "");
		setStatusId(initialStatusId ?? task?.statusId ?? statuses[0]?.id ?? "");
		setPriority(task?.priority ?? "none");
		setDueDate(dateInputValue(task?.dueDate ?? null));
		setAssigneeIds(task?.assigneeIds ?? []);
		setDescriptionTab("preview");
	}, [initialStatusId, open, statuses, task]);

	const previewDescription = useMemo(
		() => description.trim() || null,
		[description],
	);

	const handleResizeStart = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			event.preventDefault();
			const startX = event.clientX;
			const startWidth = drawerWidth;
			const previousCursor = document.body.style.cursor;
			const previousUserSelect = document.body.style.userSelect;

			document.body.style.cursor = "ew-resize";
			document.body.style.userSelect = "none";

			const handlePointerMove = (moveEvent: PointerEvent) => {
				const nextWidth = startWidth + startX - moveEvent.clientX;
				setDrawerWidth(Math.max(420, Math.min(720, nextWidth)));
			};
			const handlePointerUp = () => {
				document.body.style.cursor = previousCursor;
				document.body.style.userSelect = previousUserSelect;
				window.removeEventListener("pointermove", handlePointerMove);
				window.removeEventListener("pointerup", handlePointerUp);
			};

			window.addEventListener("pointermove", handlePointerMove);
			window.addEventListener("pointerup", handlePointerUp);
		},
		[drawerWidth],
	);

	function toggleAssignee(userId: string) {
		setAssigneeIds((current) =>
			current.includes(userId)
				? current.filter((id) => id !== userId)
				: [...current, userId],
		);
	}

	function handleSubmit() {
		if (!title.trim() || !statusId) {
			return;
		}

		onSubmit(
			{
				title: title.trim(),
				description: description.trim() ? description : null,
				primaryListId: mode === "create" ? listId : undefined,
				statusId,
				priority,
				dueDate: dateInputToIso(dueDate),
				assigneeIds,
			},
			task?.id ?? null,
		);
	}

	return (
		<Drawer
			anchor="right"
			open={open}
			onClose={onClose}
			PaperProps={{
				sx: {
					maxWidth: "100vw",
					width: { xs: "100vw", sm: drawerWidth },
				},
			}}
		>
			<Box
				onPointerDown={handleResizeStart}
				sx={{
					bgcolor: "transparent",
					cursor: "ew-resize",
					display: { xs: "none", sm: "block" },
					insetBlock: 0,
					left: 0,
					position: "absolute",
					width: 8,
					zIndex: 2,
					"&:hover": {
						bgcolor: "rgba(37, 99, 235, 0.12)",
					},
				}}
			/>
			<Stack gap={2} sx={{ p: 2.5 }}>
				<Box>
					<Typography variant="h6">
						{mode === "create" ? "Create task" : "Edit task"}
					</Typography>
					<Typography variant="body2" color="text.secondary">
						{mode === "create"
							? "Add a task to the selected list."
							: "Update task information. "}
					</Typography>
				</Box>

				{error ? (
					<Alert severity="error" sx={{ borderRadius: 1 }}>
						{error}
					</Alert>
				) : null}

				<TextField
					label="Title"
					value={title}
					onChange={(event) => setTitle(event.target.value)}
					inputProps={{ maxLength: 500 }}
					required
					fullWidth
				/>

				<FormControl fullWidth>
					<InputLabel id="task-status-label">Status</InputLabel>
					<Select
						labelId="task-status-label"
						label="Status"
						value={statusId}
						onChange={(event) => setStatusId(event.target.value)}
					>
						{statuses.map((status) => (
							<MenuItem key={status.id} value={status.id}>
								<Stack
									direction="row"
									alignItems="center"
									gap={1}
								>
									<Box
										sx={{
											bgcolor: status.color,
											borderRadius: "50%",
											height: 9,
											width: 9,
										}}
									/>
									{status.name}
								</Stack>
							</MenuItem>
						))}
					</Select>
				</FormControl>

				<Stack direction={{ xs: "column", sm: "row" }} gap={1.25}>
					<FormControl fullWidth>
						<InputLabel id="task-priority-label">
							Priority
						</InputLabel>
						<Select
							labelId="task-priority-label"
							label="Priority"
							value={priority}
							onChange={(event) =>
								setPriority(event.target.value as TaskPriority)
							}
						>
							{priorityOptions.map((option) => (
								<MenuItem
									key={option.value}
									value={option.value}
								>
									{option.label}
								</MenuItem>
							))}
						</Select>
					</FormControl>
					<TextField
						label="Due date"
						type="date"
						value={dueDate}
						onChange={(event) => setDueDate(event.target.value)}
						InputLabelProps={{ shrink: true }}
						fullWidth
					/>
				</Stack>

				<Box>
					<Box
						sx={{
							border: "1px solid",
							borderColor: "divider",
							borderRadius: 1,
							overflow: "hidden",
						}}
					>
						<Tabs
							value={descriptionTab}
							onChange={(_, nextTab: "write" | "preview") =>
								setDescriptionTab(nextTab)
							}
							sx={{
								borderBottom: "1px solid",
								borderColor: "divider",
								minHeight: 42,
								"& .MuiTab-root": {
									minHeight: 42,
								},
							}}
						>
							<Tab value="preview" label="Preview" />
							<Tab value="write" label="Edit" />
						</Tabs>
						<Box sx={{ p: 1.5 }}>
							{descriptionTab === "write" ? (
								<TextField
									label="Description"
									value={description}
									onChange={(event) =>
										setDescription(event.target.value)
									}
									multiline
									minRows={8}
									fullWidth
								/>
							) : (
								<Box sx={{ minHeight: 216 }}>
									<MarkdownPreview
										value={previewDescription}
									/>
								</Box>
							)}
						</Box>
					</Box>
				</Box>

				<Box>
					<Typography
						variant="subtitle2"
						fontWeight={800}
						sx={{ mb: 0.5 }}
					>
						Assignees
					</Typography>
					<Stack>
						{users.map((user) => (
							<FormControlLabel
								key={user.id}
								control={
									<Checkbox
										checked={assigneeIds.includes(user.id)}
										onChange={() => toggleAssignee(user.id)}
									/>
								}
								label={`${userName(user.id, users)} (${user.id})`}
							/>
						))}
					</Stack>
				</Box>

				<Divider />

				<Stack direction="row" justifyContent="space-between" gap={1}>
					{task ? (
						<Button
							color="error"
							startIcon={<DeleteIcon />}
							disabled={isDeleting || isSaving}
							onClick={() => {
								if (window.confirm(`Delete "${task.title}"?`)) {
									onDelete(task.id);
								}
							}}
						>
							Delete
						</Button>
					) : (
						<Box />
					)}
					<Stack direction="row" gap={1}>
						<Button onClick={onClose}>Cancel</Button>
						<Button
							variant="contained"
							startIcon={<SaveOutlinedIcon />}
							disabled={
								!title.trim() ||
								!statusId ||
								isSaving ||
								isDeleting
							}
							onClick={handleSubmit}
						>
							{mode === "create" ? "Create" : "Save"}
						</Button>
					</Stack>
				</Stack>
			</Stack>
		</Drawer>
	);
}
