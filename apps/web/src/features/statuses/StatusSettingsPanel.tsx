import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import {
	Alert,
	Box,
	Button,
	Chip,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	FormControl,
	InputLabel,
	MenuItem,
	Select,
	Stack,
	TextField,
	Typography
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
	createStatus,
	deleteStatus,
	listStatuses,
	updateStatus,
	type Status,
	type StatusCategory
} from "../../api/client";
import { errorMessage, sortStatuses } from "../tasks/task-utils";

const categories: Array<{ value: StatusCategory; label: string }> = [
	{ value: "todo", label: "Todo" },
	{ value: "in_progress", label: "In progress" },
	{ value: "done", label: "Done" }
];

type StatusSettingsPanelProps = {
	currentUserId: string;
	listId: string;
};

export function StatusSettingsPanel({ currentUserId, listId }: StatusSettingsPanelProps) {
	const queryClient = useQueryClient();
	const [newName, setNewName] = useState("");
	const [newKey, setNewKey] = useState("");
	const [newCategory, setNewCategory] = useState<StatusCategory>("todo");
	const [newColor, setNewColor] = useState("#64748b");
	const [deleteTarget, setDeleteTarget] = useState<Status | null>(null);
	const statusesQuery = useQuery({
		queryKey: ["statuses", currentUserId, listId],
		queryFn: ({ signal }) => listStatuses(currentUserId, listId, signal),
		staleTime: 10_000
	});
	const statuses = useMemo(
		() => sortStatuses(statusesQuery.data ?? []),
		[statusesQuery.data]
	);
	const invalidateListData = () => {
		void queryClient.invalidateQueries({ queryKey: ["statuses", currentUserId, listId] });
		void queryClient.invalidateQueries({ queryKey: ["tasks", currentUserId, listId] });
	};
	const createMutation = useMutation({
		mutationFn: () =>
			createStatus(currentUserId, {
				listId,
				key: newKey.trim() || slugifyStatusKey(newName),
				name: newName.trim(),
				category: newCategory,
				color: newColor,
				position: statuses.length
			}),
		onSuccess: () => {
			setNewName("");
			setNewKey("");
			setNewCategory("todo");
			setNewColor("#64748b");
			invalidateListData();
		}
	});
	const updateMutation = useMutation({
		mutationFn: ({
			statusId,
			name,
			category,
			color
		}: {
			statusId: string;
			name: string;
			category: StatusCategory;
			color?: string;
		}) => updateStatus(currentUserId, statusId, { name, category, color }),
		onSuccess: invalidateListData
	});
	const deleteMutation = useMutation({
		mutationFn: (statusId: string) => deleteStatus(currentUserId, statusId),
		onSuccess: () => {
			setDeleteTarget(null);
			invalidateListData();
		}
	});

	function resetMutations() {
		createMutation.reset();
		updateMutation.reset();
		deleteMutation.reset();
	}

	useEffect(() => {
		resetMutations();
		setDeleteTarget(null);
	}, [listId]);

	if (statusesQuery.isLoading) {
		return (
			<Stack direction="row" alignItems="center" gap={1}>
				<CircularProgress size={18} />
				<Typography variant="body2" color="text.secondary">
					Loading statuses
				</Typography>
			</Stack>
		);
	}

	if (statusesQuery.isError) {
		return (
			<Alert severity="error" sx={{ borderRadius: 1 }}>
				{errorMessage(statusesQuery.error, "Statuses could not be loaded.")}
			</Alert>
		);
	}

	const mutationError = createMutation.error ?? updateMutation.error ?? deleteMutation.error;
	const busy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

	return (
		<Stack gap={1.5}>
			{mutationError ? (
				<Alert severity="error" sx={{ borderRadius: 1 }}>
					{errorMessage(mutationError, "Status settings could not be saved.")}
				</Alert>
			) : null}

			<Stack gap={1}>
				{statuses.map((status) => (
					<StatusRow
						key={status.id}
						status={status}
						disabled={busy}
						onSave={(payload) =>
							updateMutation.mutate({
								statusId: status.id,
								...payload
							})
						}
						onDelete={() => setDeleteTarget(status)}
					/>
				))}
			</Stack>

			<Box
				sx={{
					border: "1px solid",
					borderColor: "divider",
					borderRadius: 1,
					p: 2
				}}
			>
				<Stack gap={1.5}>
					<Box>
						<Typography variant="subtitle2" fontWeight={800}>
							Add status
						</Typography>
						<Typography variant="caption" color="text.secondary">
							Key is generated from the name and can be adjusted before creation.
						</Typography>
					</Box>
					<Box
						sx={{
							display: "grid",
							gap: 1.25,
							gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }
						}}
					>
						<TextField
							label="Name"
							value={newName}
							onChange={(event) => {
								resetMutations();
								setNewName(event.target.value);
								setNewKey(slugifyStatusKey(event.target.value));
							}}
							size="small"
							fullWidth
						/>
						<TextField
							label="Key"
							value={newKey}
							onChange={(event) => {
								resetMutations();
								setNewKey(slugifyStatusKey(event.target.value));
							}}
							helperText={`Preview: ${newKey || "status_key"}`}
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
							<InputLabel id="new-status-category-label">Category</InputLabel>
							<Select
								labelId="new-status-category-label"
								label="Category"
								value={newCategory}
								onChange={(event) => {
									resetMutations();
									setNewCategory(event.target.value as StatusCategory);
								}}
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
							value={newColor}
							onChange={(event) => {
								resetMutations();
								setNewColor(event.target.value);
							}}
							size="small"
							InputLabelProps={{ shrink: true }}
							fullWidth
						/>
					</Box>
					<Stack direction="row" justifyContent="flex-end">
						<Button
							size="small"
							variant="contained"
							startIcon={<AddCircleOutlineIcon />}
							disabled={!newName.trim() || busy}
							onClick={() => {
								resetMutations();
								createMutation.mutate();
							}}
							sx={{ minWidth: 116 }}
						>
							Create
						</Button>
					</Stack>
				</Stack>
			</Box>

			<Dialog
				open={Boolean(deleteTarget)}
				onClose={() => {
					resetMutations();
					setDeleteTarget(null);
				}}
			>
				<DialogTitle>Delete status</DialogTitle>
				<DialogContent>
					<Typography>
						Delete {deleteTarget?.name}? The backend will reject deletion if any task still uses it.
					</Typography>
				</DialogContent>
				<DialogActions>
					<Button
						onClick={() => {
							resetMutations();
							setDeleteTarget(null);
						}}
					>
						Cancel
					</Button>
					<Button
						color="error"
						variant="contained"
						disabled={deleteMutation.isPending || !deleteTarget}
						onClick={() => {
							resetMutations();

							if (deleteTarget) {
								deleteMutation.mutate(deleteTarget.id);
							}
						}}
					>
						Delete
					</Button>
				</DialogActions>
			</Dialog>
		</Stack>
	);
}

type StatusRowProps = {
	status: Status;
	disabled: boolean;
	onSave: (payload: {
		name: string;
		category: StatusCategory;
		color?: string;
	}) => void;
	onDelete: () => void;
};

function StatusRow({ status, disabled, onSave, onDelete }: StatusRowProps) {
	const [name, setName] = useState(status.name);
	const [category, setCategory] = useState<StatusCategory>(status.category);
	const [color, setColor] = useState(status.color);

	useEffect(() => {
		setName(status.name);
		setCategory(status.category);
		setColor(status.color);
	}, [status]);

	const changed =
		name.trim() !== status.name ||
		category !== status.category ||
		(!status.isDefault && color !== status.color);

	return (
		<Box
			sx={{
				border: "1px solid",
				borderColor: "divider",
				borderRadius: 1,
				p: 1.25
			}}
		>
			<Stack gap={1}>
				<Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
					<Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
						<Box
							sx={{
								bgcolor: color,
								borderRadius: "50%",
								flex: "0 0 auto",
								height: 10,
								width: 10
							}}
						/>
						<Typography variant="body2" fontWeight={800} noWrap>
							{status.key}
						</Typography>
						{status.isDefault ? (
							<Chip size="small" label="default" variant="outlined" />
						) : null}
					</Stack>
					<Button
						size="small"
						color="error"
						startIcon={<DeleteIcon />}
						disabled={disabled || status.isDefault}
						onClick={onDelete}
					>
						Delete
					</Button>
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
						<InputLabel id={`${status.id}-category-label`}>Category</InputLabel>
						<Select
							labelId={`${status.id}-category-label`}
							label="Category"
							value={category}
							onChange={(event) => setCategory(event.target.value as StatusCategory)}
						>
							{categories.map((option) => (
								<MenuItem key={option.value} value={option.value}>
									{option.label}
								</MenuItem>
							))}
						</Select>
					</FormControl>
					<TextField
						label="Color"
						type="color"
						value={color}
						onChange={(event) => setColor(event.target.value)}
						size="small"
						InputLabelProps={{ shrink: true }}
						disabled={status.isDefault}
						fullWidth
					/>
					<Button
						size="small"
						variant="outlined"
						startIcon={<SaveOutlinedIcon />}
						disabled={disabled || !changed || !name.trim()}
						onClick={() =>
							onSave({
								name: name.trim(),
								category,
								...(status.isDefault ? {} : { color })
							})
						}
						sx={{ minWidth: 96 }}
					>
						Save
					</Button>
				</Stack>
			</Stack>
		</Box>
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
