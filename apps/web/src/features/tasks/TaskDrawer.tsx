import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
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
	TextField,
	Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import type { Status, Task, TaskPayload, TaskPriority, User } from "../../api/client";
import { MarkdownPreview } from "./MarkdownPreview";
import {
	dateInputToIso,
	dateInputValue,
	priorityOptions,
	userName
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
	onDelete
}: TaskDrawerProps) {
	const defaultStatusId = initialStatusId ?? task?.statusId ?? statuses[0]?.id ?? "";
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [statusId, setStatusId] = useState(defaultStatusId);
	const [priority, setPriority] = useState<TaskPriority>("none");
	const [dueDate, setDueDate] = useState("");
	const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
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
	}, [initialStatusId, open, statuses, task]);

	const previewDescription = useMemo(
		() => description.trim() || null,
		[description]
	);

	function toggleAssignee(userId: string) {
		setAssigneeIds((current) =>
			current.includes(userId)
				? current.filter((id) => id !== userId)
				: [...current, userId]
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
				assigneeIds
			},
			task?.id ?? null
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
					width: { xs: "100vw", sm: 460 }
				}
			}}
		>
			<Stack gap={2} sx={{ p: 2.5 }}>
				<Box>
					<Typography variant="h6">
						{mode === "create" ? "Create task" : "Task details"}
					</Typography>
					<Typography variant="body2" color="text.secondary">
						{mode === "create" ? "Add a task to the selected list." : "Edit task fields and preview markdown."}
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
								<Stack direction="row" alignItems="center" gap={1}>
									<Box
										sx={{
											bgcolor: status.color,
											borderRadius: "50%",
											height: 9,
											width: 9
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
						<InputLabel id="task-priority-label">Priority</InputLabel>
						<Select
							labelId="task-priority-label"
							label="Priority"
							value={priority}
							onChange={(event) => setPriority(event.target.value as TaskPriority)}
						>
							{priorityOptions.map((option) => (
								<MenuItem key={option.value} value={option.value}>
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

				<TextField
					label="Description"
					value={description}
					onChange={(event) => setDescription(event.target.value)}
					multiline
					minRows={6}
					fullWidth
				/>

				<Box>
					<Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
						Markdown preview
					</Typography>
					<Box
						sx={{
							border: "1px solid",
							borderColor: "divider",
							borderRadius: 1,
							minHeight: 96,
							p: 1.5
						}}
					>
						<MarkdownPreview value={previewDescription} />
					</Box>
				</Box>

				<Box>
					<Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.5 }}>
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
							startIcon={<DeleteOutlineIcon />}
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
							disabled={!title.trim() || !statusId || isSaving || isDeleting}
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
