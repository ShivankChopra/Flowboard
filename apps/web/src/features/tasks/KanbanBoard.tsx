import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import {
	Box,
	Button,
	Chip,
	Paper,
	Stack,
	Tooltip,
	Typography,
} from "@mui/material";
import { useMemo, useState, type DragEvent } from "react";
import type { Status, Task, User } from "../../api/client";
import { MarkdownPreview } from "./MarkdownPreview";
import { AssigneeInitials, DueDateMeta, PriorityBadge } from "./TaskMetadata";
import {
	priorityVisuals,
	tasksForStatus,
} from "./task-utils";

type KanbanBoardProps = {
	statuses: Status[];
	tasks: Task[];
	users: User[];
	isMutating: boolean;
	onCreateTask: (statusId: string) => void;
	onOpenTask: (task: Task) => void;
	onMoveTask: (
		taskId: string,
		targetStatusId: string,
		targetPosition: number,
	) => void;
	onReorderColumn: (statusId: string, orderedTaskIds: string[]) => void;
};

type DragState = {
	taskId: string;
	statusId: string;
	index: number;
};

type DropTarget = {
	statusId: string;
	index: number;
};

export function KanbanBoard({
	statuses,
	tasks,
	users,
	isMutating,
	onCreateTask,
	onOpenTask,
	onMoveTask,
	onReorderColumn,
}: KanbanBoardProps) {
	const [dragging, setDragging] = useState<DragState | null>(null);
	const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
	const tasksByStatus = useMemo(
		() =>
			new Map(
				statuses.map((status) => [
					status.id,
					tasksForStatus(tasks, status.id),
				]),
			),
		[statuses, tasks],
	);
	const columnCount = Math.max(statuses.length, 1);
	const boardMinWidth = `max(100%, ${
		columnCount * 280 + Math.max(columnCount - 1, 0) * 16
	}px)`;

	function handleDrop(statusId: string, index: number) {
		if (!dragging || isMutating) {
			setDragging(null);
			setDropTarget(null);
			return;
		}

		const targetTasks = tasksByStatus.get(statusId) ?? [];
		const clampedIndex = Math.max(0, Math.min(index, targetTasks.length));

		if (dragging.statusId === statusId) {
			const remainingIds = targetTasks
				.filter((task) => task.id !== dragging.taskId)
				.map((task) => task.id);
			const targetIndex =
				dragging.index < clampedIndex ? clampedIndex - 1 : clampedIndex;
			const insertIndex = Math.max(
				0,
				Math.min(targetIndex, remainingIds.length),
			);
			const orderedTaskIds = [...remainingIds];
			orderedTaskIds.splice(insertIndex, 0, dragging.taskId);

			if (
				orderedTaskIds.join("|") !==
				targetTasks.map((task) => task.id).join("|")
			) {
				onReorderColumn(statusId, orderedTaskIds);
			}
		} else {
			onMoveTask(dragging.taskId, statusId, clampedIndex);
		}

		setDragging(null);
		setDropTarget(null);
	}

	return (
		<Box sx={{ minWidth: 0, overflowX: "auto", pb: 0.5 }}>
			<Box
				sx={{
					alignItems: "start",
					display: "grid",
					gap: 2,
					gridTemplateColumns: {
						xs: "1fr",
						lg: `repeat(${columnCount}, minmax(280px, 1fr))`,
					},
					minWidth: { xs: "100%", lg: boardMinWidth },
				}}
			>
			{statuses.map((status) => {
				const columnTasks = tasksByStatus.get(status.id) ?? [];
				const isColumnTarget = dropTarget?.statusId === status.id;

				return (
					<Paper
						aria-label={`${status.name} kanban column`}
						data-testid={`kanban-column-${status.key}`}
						key={status.id}
						variant="outlined"
						onDragOver={(event) => {
							event.preventDefault();
							setDropTarget({
								statusId: status.id,
								index: columnTasks.length,
							});
						}}
						onDrop={() => handleDrop(status.id, columnTasks.length)}
						sx={{
							bgcolor: "rgba(255, 255, 255, 0.72)",
							display: "flex",
							flexDirection: "column",
							maxHeight: { xs: "none", md: "calc(100vh - 250px)" },
							minHeight: 220,
							overflow: "hidden",
						}}
					>
						<Stack
							direction="row"
							alignItems="center"
							justifyContent="space-between"
							gap={1}
							sx={{
								borderBottom: "1px solid",
								borderColor: "divider",
								px: 1.5,
								py: 1.25,
							}}
						>
							<Stack
								direction="row"
								alignItems="center"
								gap={1}
								sx={{ minWidth: 0 }}
							>
								<Box
									sx={{
										bgcolor: status.color,
										borderRadius: "50%",
										flex: "0 0 auto",
										height: 10,
										width: 10,
									}}
								/>
								<Typography
									variant="subtitle2"
									fontWeight={800}
									noWrap
								>
									{status.name}
								</Typography>
								<Chip
									size="small"
									label={columnTasks.length}
									variant="outlined"
								/>
							</Stack>
							<Tooltip title={`Create task in ${status.name}`}>
								<Button
									size="small"
									startIcon={<AddCircleOutlineIcon />}
									onClick={() => onCreateTask(status.id)}
									sx={{ minWidth: 0 }}
								>
									Add
								</Button>
							</Tooltip>
						</Stack>
						<Stack
							gap={1}
							sx={{
								minHeight: 0,
								overflowY: { xs: "visible", md: "auto" },
								p: 1.25,
							}}
						>
							{columnTasks.map((task, index) => (
								<Box
									key={task.id}
									onDragOver={(event) => {
										event.preventDefault();
										event.stopPropagation();
										setDropTarget({
											statusId: status.id,
											index,
										});
									}}
									onDrop={(event) => {
										event.stopPropagation();
										handleDrop(status.id, index);
									}}
									sx={{
										// borderTop:
										// 	isColumnTarget &&
										// 	dropTarget.index === index
										// 		? "2px solid"
										// 		: "2px solid transparent",
										// borderColor: "primary.main",
										pt:
											isColumnTarget &&
											dropTarget.index === index
												? 0.75
												: 0,
									}}
								>
									<TaskCard
										task={task}
										users={users}
										dragging={dragging?.taskId === task.id}
										disabled={isMutating}
										onClick={() => onOpenTask(task)}
										onDragStart={(event) => {
											event.dataTransfer.effectAllowed =
												"move";
											event.dataTransfer.setData(
												"text/plain",
												task.id,
											);
											setDragging({
												taskId: task.id,
												statusId: status.id,
												index,
											});
										}}
										onDragEnd={() => {
											setDragging(null);
											setDropTarget(null);
										}}
									/>
								</Box>
							))}
							{isColumnTarget &&
							dropTarget.index === columnTasks.length ? (
								<Box
									sx={{
										border: "2px dashed",
										borderColor: "primary.main",
										borderRadius: 1,
										height: 42,
									}}
								/>
							) : null}
							{columnTasks.length === 0 ? (
								<Box
									sx={{
										border: "1px dashed",
										borderColor: "divider",
										borderRadius: 1,
										color: "text.secondary",
										px: 1.5,
										py: 2,
										textAlign: "center",
									}}
								>
									<Typography variant="body2">
										No tasks
									</Typography>
								</Box>
							) : null}
						</Stack>
					</Paper>
				);
			})}
			</Box>
		</Box>
	);
}

type TaskCardProps = {
	task: Task;
	users: User[];
	dragging: boolean;
	disabled: boolean;
	onClick: () => void;
	onDragStart: (event: DragEvent<HTMLDivElement>) => void;
	onDragEnd: () => void;
};

function TaskCard({
	task,
	users,
	dragging,
	disabled,
	onClick,
	onDragStart,
	onDragEnd,
}: TaskCardProps) {
	const priorityVisual = priorityVisuals[task.priority];

	return (
		<Paper
			aria-label={`Task card ${task.title}`}
			data-testid="task-card"
			variant="outlined"
			draggable={!disabled}
			onDragStart={onDragStart}
			onDragEnd={onDragEnd}
			onClick={onClick}
			sx={{
				bgcolor: "background.paper",
				border: "1px solid",
				borderColor: "rgba(148, 163, 184, 0.42)",
				borderLeft: "4px solid",
				borderLeftColor:
					task.priority === "none"
						? "rgba(148, 163, 184, 0.42)"
						: priorityVisual.color,
				boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
				cursor: disabled ? "default" : "grab",
				opacity: dragging ? 0.48 : 1,
				p: 1.35,
				transition:
					"border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease",
				"&:hover": {
					borderColor: "primary.light",
					boxShadow: "0 10px 22px rgba(15, 23, 42, 0.1)",
					transform: disabled ? "none" : "translateY(-1px)",
				},
			}}
		>
			<Stack gap={1.15}>
				<Stack direction="row" alignItems="flex-start" gap={0.75}>
					<Box
						sx={{
							alignItems: "center",
							color: "text.disabled",
							display: "flex",
							height: 22,
							mt: 0.1,
						}}
					>
						<DragIndicatorIcon sx={{ fontSize: 18 }} />
					</Box>
					<Stack gap={0.75} sx={{ flex: 1, minWidth: 0 }}>
						<Stack
							direction="row"
							alignItems="flex-start"
							justifyContent="space-between"
							gap={1}
						>
							<Typography
								variant="body2"
								fontWeight={850}
								sx={{
									flex: 1,
									lineHeight: 1.35,
									minWidth: 0,
									overflowWrap: "anywhere",
								}}
							>
								{task.title}
							</Typography>
							<PriorityBadge priority={task.priority} />
						</Stack>
					</Stack>
				</Stack>
				{task.description ? (
					<Box
						sx={{
							color: "text.secondary",
							display: "-webkit-box",
							overflow: "hidden",
							WebkitBoxOrient: "vertical",
							WebkitLineClamp: 2,
							"& p": {
								fontSize: 12.5,
								lineHeight: 1.45,
								margin: 0,
							},
						}}
					>
						<MarkdownPreview value={task.description} />
					</Box>
				) : null}
				<Stack
					direction="row"
					alignItems="center"
					justifyContent="space-between"
					gap={1}
					sx={{ minHeight: 30 }}
				>
					<DueDateMeta dueDate={task.dueDate} />
					<AssigneeInitials
						assigneeIds={task.assigneeIds}
						users={users}
						size={28}
						max={3}
					/>
				</Stack>
			</Stack>
		</Paper>
	);
}
