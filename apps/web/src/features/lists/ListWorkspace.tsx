import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import FormatListBulletedOutlinedIcon from "@mui/icons-material/FormatListBulletedOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import ViewKanbanOutlinedIcon from "@mui/icons-material/ViewKanbanOutlined";
import {
	Alert,
	Box,
	Button,
	CircularProgress,
	Divider,
	InputAdornment,
	Stack,
	TextField,
	ToggleButton,
	ToggleButtonGroup,
	Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
	createTask,
	deleteTask,
	listStatuses,
	listTasks,
	listUsers,
	moveTask,
	reorderTasks,
	updateTask,
	type ContainerTreeNode,
	type SortDirection,
	type Task,
	type TaskPayload,
	type TaskSort,
} from "../../api/client";
import { useAppUi } from "../../state/app-ui-context";
import { DenseTaskList } from "../tasks/DenseTaskList";
import { KanbanBoard } from "../tasks/KanbanBoard";
import { TaskDrawer } from "../tasks/TaskDrawer";
import { errorMessage, sortStatuses } from "../tasks/task-utils";

type ListWorkspaceProps = {
	list: ContainerTreeNode;
};

type DrawerState =
	| { mode: "closed"; taskId?: undefined; statusId?: undefined }
	| { mode: "create"; statusId: string | null; taskId?: undefined }
	| { mode: "edit"; taskId: string; statusId?: undefined };

export function ListWorkspace({ list }: ListWorkspaceProps) {
	const queryClient = useQueryClient();
	const { selectedUserId } = useAppUi();
	const [view, setView] = useState<"Board" | "list">("list");
	const [listSort, setListSort] = useState<TaskSort>("position");
	const [listDirection, setListDirection] = useState<SortDirection>("asc");
	const [listPage, setListPage] = useState(0);
	const [listRowsPerPage, setListRowsPerPage] = useState(10);
	const [taskSearch, setTaskSearch] = useState("");
	const [debouncedTaskSearch, setDebouncedTaskSearch] = useState("");
	const [drawerState, setDrawerState] = useState<DrawerState>({
		mode: "closed",
	});
	const [mutationError, setMutationError] = useState<string | null>(null);
	const taskSort = view === "list" ? listSort : "position";
	const taskDirection = view === "list" ? listDirection : "asc";
	const activeTaskSearch =
		view === "list" ? debouncedTaskSearch.trim() : "";
	const taskLimit = view === "list" ? listRowsPerPage : 100;
	const taskOffset = view === "list" ? listPage * listRowsPerPage : 0;

	useEffect(() => {
		setDrawerState({ mode: "closed" });
		setMutationError(null);
		setListPage(0);
		setTaskSearch("");
		setDebouncedTaskSearch("");
	}, [list.id, selectedUserId]);

	useEffect(() => {
		setListPage(0);
	}, [activeTaskSearch, listDirection, listSort]);

	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			setDebouncedTaskSearch(taskSearch);
		}, 300);

		return () => window.clearTimeout(timeoutId);
	}, [taskSearch]);

	const statusesQuery = useQuery({
		queryKey: ["statuses", selectedUserId, list.id],
		queryFn: ({ signal }) => listStatuses(selectedUserId, list.id, signal),
		staleTime: 20_000,
	});
	const tasksQuery = useQuery({
		queryKey: [
			"tasks",
			selectedUserId,
			list.id,
			taskSort,
			taskDirection,
			taskLimit,
			taskOffset,
			activeTaskSearch,
		],
		queryFn: ({ signal }) =>
			listTasks(
				selectedUserId,
				{
					listId: list.id,
					limit: taskLimit,
					offset: taskOffset,
					sort: taskSort,
					direction: taskDirection,
					q: activeTaskSearch,
				},
				signal,
			),
		staleTime: 10_000,
	});
	const usersQuery = useQuery({
		queryKey: ["users", selectedUserId],
		queryFn: ({ signal }) => listUsers(selectedUserId, signal),
		staleTime: 60_000,
	});

	const statuses = useMemo(
		() => sortStatuses(statusesQuery.data ?? []),
		[statusesQuery.data],
	);
	const tasks = tasksQuery.data?.data ?? [];
	const taskTotal = tasksQuery.data?.pagination.total ?? tasks.length;
	const hasTaskSearch = activeTaskSearch.length > 0;
	const users = usersQuery.data ?? [];
	const selectedTask =
		drawerState.mode === "edit"
			? (tasks.find((task) => task.id === drawerState.taskId) ?? null)
			: null;

	const invalidateTasks = () =>
		queryClient.invalidateQueries({
			queryKey: ["tasks", selectedUserId, list.id],
		});

	const createMutation = useMutation({
		mutationFn: (payload: TaskPayload) =>
			createTask(selectedUserId, payload),
		onMutate: () => setMutationError(null),
		onSuccess: () => {
			setDrawerState({ mode: "closed" });
			void invalidateTasks();
		},
		onError: (error) =>
			setMutationError(errorMessage(error, "Task could not be created.")),
	});
	const updateMutation = useMutation({
		mutationFn: ({
			taskId,
			payload,
		}: {
			taskId: string;
			payload: TaskPayload;
		}) => updateTask(selectedUserId, taskId, payload),
		onMutate: () => setMutationError(null),
		onSuccess: () => {
			setDrawerState({ mode: "closed" });
			void invalidateTasks();
		},
		onError: (error) =>
			setMutationError(errorMessage(error, "Task could not be updated.")),
	});
	const moveMutation = useMutation({
		mutationFn: ({
			taskId,
			statusId,
			position,
		}: {
			taskId: string;
			statusId: string;
			position: number;
		}) =>
			moveTask(selectedUserId, taskId, {
				targetStatusId: statusId,
				targetPosition: position,
			}),
		onMutate: () => setMutationError(null),
		onSuccess: () => void invalidateTasks(),
		onError: (error) =>
			setMutationError(errorMessage(error, "Task could not be moved.")),
	});
	const reorderMutation = useMutation({
		mutationFn: ({
			statusId,
			orderedTaskIds,
		}: {
			statusId: string;
			orderedTaskIds: string[];
		}) =>
			reorderTasks(selectedUserId, {
				columns: [
					{
						listId: list.id,
						statusId,
						orderedTaskIds,
					},
				],
			}),
		onMutate: () => setMutationError(null),
		onSuccess: () => void invalidateTasks(),
		onError: (error) =>
			setMutationError(
				errorMessage(error, "Task order could not be saved."),
			),
	});
	const deleteMutation = useMutation({
		mutationFn: (taskId: string) => deleteTask(selectedUserId, taskId),
		onMutate: () => setMutationError(null),
		onSuccess: () => {
			setDrawerState({ mode: "closed" });
			void invalidateTasks();
		},
		onError: (error) =>
			setMutationError(errorMessage(error, "Task could not be deleted.")),
	});
	const isMutating =
		createMutation.isPending ||
		updateMutation.isPending ||
		moveMutation.isPending ||
		reorderMutation.isPending ||
		deleteMutation.isPending;
	const isRefreshing = statusesQuery.isFetching || tasksQuery.isFetching;

	useEffect(() => {
		if (view !== "list" || taskTotal === 0 || listPage === 0) {
			return;
		}

		if (listPage * listRowsPerPage >= taskTotal) {
			setListPage(Math.max(0, Math.ceil(taskTotal / listRowsPerPage) - 1));
		}
	}, [listPage, listRowsPerPage, taskTotal, view]);

	function handleSort(nextSort: TaskSort) {
		if (nextSort === listSort) {
			setListDirection((current) => (current === "asc" ? "desc" : "asc"));
			return;
		}

		setListSort(nextSort);
		setListDirection("asc");
	}

	function handleSubmit(payload: TaskPayload, taskId: string | null) {
		if (taskId) {
			updateMutation.mutate({ taskId, payload });
			return;
		}

		createMutation.mutate(payload);
	}

	if (
		statusesQuery.isLoading ||
		tasksQuery.isLoading ||
		usersQuery.isLoading
	) {
		return (
			<Stack alignItems="center" gap={1.5} sx={{ py: 8 }}>
				<CircularProgress size={26} />
				<Typography variant="body2" color="text.secondary">
					Loading tasks
				</Typography>
			</Stack>
		);
	}

	if (statusesQuery.isError || tasksQuery.isError || usersQuery.isError) {
		return (
			<Alert severity="error" sx={{ borderRadius: 1 }}>
				{statusesQuery.error
					? errorMessage(
							statusesQuery.error,
							"Statuses could not be loaded.",
						)
					: tasksQuery.error
						? errorMessage(
								tasksQuery.error,
								"Tasks could not be loaded.",
							)
						: errorMessage(
								usersQuery.error,
								"Users could not be loaded.",
							)}
			</Alert>
		);
	}

	return (
		<Stack gap={2.5} sx={{ minHeight: 0, minWidth: 0 }}>
			<Stack
				direction={{ xs: "column", md: "row" }}
				alignItems={{ xs: "stretch", md: "center" }}
				justifyContent="space-between"
				gap={1.5}
			>
				<Stack
					direction="row"
					gap={1}
					alignItems="center"
					flexWrap="wrap"
				>
					<ToggleButtonGroup
						exclusive
						size="small"
						value={view}
						onChange={(_, nextView: "Board" | "list" | null) => {
							if (nextView) {
								setView(nextView);
							}
						}}
					>
						<ToggleButton value="list">
							<FormatListBulletedOutlinedIcon fontSize="small" />
							<Box component="span" sx={{ ml: 0.75 }}>
								List
							</Box>
						</ToggleButton>
						<ToggleButton value="Board">
							<ViewKanbanOutlinedIcon fontSize="small" />
							<Box component="span" sx={{ ml: 0.75 }}>
								Board
							</Box>
						</ToggleButton>
					</ToggleButtonGroup>
					<Button
						size="small"
						startIcon={
							isRefreshing ? (
								<CircularProgress size={16} color="inherit" />
							) : (
								<RefreshOutlinedIcon />
							)
						}
						disabled={isRefreshing}
						onClick={() => {
							void statusesQuery.refetch();
							void tasksQuery.refetch();
						}}
					>
						Refresh
					</Button>
				</Stack>
				<Button
					variant="contained"
					startIcon={<AddCircleOutlineIcon />}
					onClick={() =>
						setDrawerState({
							mode: "create",
							statusId: statuses[0]?.id ?? null,
						})
					}
				>
					New task
				</Button>
			</Stack>

			{mutationError ? (
				<Alert
					severity="error"
					onClose={() => setMutationError(null)}
					sx={{ borderRadius: 1 }}
				>
					{mutationError}
				</Alert>
			) : null}

			{view === "list" ? (
				<TextField
					size="small"
					value={taskSearch}
					onChange={(event) => setTaskSearch(event.target.value)}
					placeholder="Search tasks"
					inputProps={{ "aria-label": "Search tasks" }}
					InputProps={{
						startAdornment: (
							<InputAdornment position="start">
								<SearchOutlinedIcon fontSize="small" />
							</InputAdornment>
						),
					}}
					sx={{ maxWidth: 360 }}
				/>
			) : null}

			{tasks.length === 0 ? (
				<EmptyTaskState
					hasSearch={hasTaskSearch}
					onCreate={() =>
						setDrawerState({
							mode: "create",
							statusId: statuses[0]?.id ?? null,
						})
					}
				/>
			) : view === "Board" ? (
				<KanbanBoard
					statuses={statuses}
					tasks={tasks}
					users={users}
					isMutating={isMutating}
					onCreateTask={(statusId) =>
						setDrawerState({ mode: "create", statusId })
					}
					onOpenTask={(task) =>
						setDrawerState({ mode: "edit", taskId: task.id })
					}
					onMoveTask={(taskId, statusId, position) =>
						moveMutation.mutate({ taskId, statusId, position })
					}
					onReorderColumn={(statusId, orderedTaskIds) =>
						reorderMutation.mutate({ statusId, orderedTaskIds })
					}
				/>
			) : (
				<DenseTaskList
					statuses={statuses}
					tasks={tasks}
					users={users}
					sort={listSort}
					direction={listDirection}
					count={taskTotal}
					page={listPage}
					rowsPerPage={listRowsPerPage}
					onSort={handleSort}
					onPageChange={setListPage}
					onRowsPerPageChange={(rowsPerPage) => {
						setListRowsPerPage(rowsPerPage);
						setListPage(0);
					}}
					onEditTask={(task: Task) =>
						setDrawerState({ mode: "edit", taskId: task.id })
					}
				/>
			)}

			<Divider />
			<Typography variant="caption" color="text.secondary">
				Showing {tasks.length} of{" "}
				{taskTotal} tasks
				{hasTaskSearch ? ` matching "${activeTaskSearch}"` : ""}.
			</Typography>

			<TaskDrawer
				open={drawerState.mode !== "closed"}
				listId={list.id}
				statuses={statuses}
				users={users}
				task={selectedTask}
				initialStatusId={
					drawerState.mode === "create" ? drawerState.statusId : null
				}
				isSaving={createMutation.isPending || updateMutation.isPending}
				isDeleting={deleteMutation.isPending}
				error={mutationError}
				onClose={() => setDrawerState({ mode: "closed" })}
				onSubmit={handleSubmit}
				onDelete={(taskId) => deleteMutation.mutate(taskId)}
			/>
		</Stack>
	);
}

function EmptyTaskState({
	hasSearch,
	onCreate,
}: {
	hasSearch: boolean;
	onCreate: () => void;
}) {
	return (
		<Box
			sx={{
				alignItems: "center",
				border: "1px dashed",
				borderColor: "divider",
				borderRadius: 1,
				display: "flex",
				justifyContent: "center",
				minHeight: 260,
				p: 3,
				textAlign: "center",
			}}
		>
			<Stack alignItems="center" gap={1.25}>
				<Typography variant="h6">
					{hasSearch ? "No matching tasks" : "No tasks yet"}
				</Typography>
				<Typography color="text.secondary">
					{hasSearch
						? "Try a different search term."
						: "Create the first task in this list."}
				</Typography>
				{hasSearch ? null : (
					<Button
						variant="contained"
						startIcon={<AddCircleOutlineIcon />}
						onClick={onCreate}
					>
						New task
					</Button>
				)}
			</Stack>
		</Box>
	);
}
