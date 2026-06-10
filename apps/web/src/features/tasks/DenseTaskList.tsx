import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import {
	Box,
	Chip,
	Paper,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableRow,
	TableSortLabel,
	Typography
} from "@mui/material";
import type { SortDirection, Status, Task, TaskSort, User } from "../../api/client";
import {
	formatDueDate,
	priorityColor,
	priorityOptions,
	userName
} from "./task-utils";

type DenseTaskListProps = {
	statuses: Status[];
	tasks: Task[];
	users: User[];
	sort: TaskSort;
	direction: SortDirection;
	onSort: (sort: TaskSort) => void;
	onOpenTask: (task: Task) => void;
};

export function DenseTaskList({
	statuses,
	tasks,
	users,
	sort,
	direction,
	onSort,
	onOpenTask
}: DenseTaskListProps) {
	const statusById = new Map(statuses.map((status) => [status.id, status]));

	return (
		<Paper variant="outlined" sx={{ overflow: "hidden" }}>
			<Box sx={{ overflowX: "auto" }}>
				<Table size="small" sx={{ minWidth: 860 }}>
					<TableHead>
						<TableRow>
							<TableCell>Task</TableCell>
							<TableCell>Status</TableCell>
							<TableCell sortDirection={sort === "priority" ? direction : false}>
								<TableSortLabel
									active={sort === "priority"}
									direction={sort === "priority" ? direction : "asc"}
									onClick={() => onSort("priority")}
								>
									Priority
								</TableSortLabel>
							</TableCell>
							<TableCell sortDirection={sort === "dueDate" ? direction : false}>
								<TableSortLabel
									active={sort === "dueDate"}
									direction={sort === "dueDate" ? direction : "asc"}
									onClick={() => onSort("dueDate")}
								>
									Due
								</TableSortLabel>
							</TableCell>
							<TableCell>Assignees</TableCell>
							<TableCell sortDirection={sort === "position" ? direction : false}>
								<TableSortLabel
									active={sort === "position"}
									direction={sort === "position" ? direction : "asc"}
									onClick={() => onSort("position")}
								>
									Board order
								</TableSortLabel>
							</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{tasks.map((task) => {
							const status = statusById.get(task.statusId);
							const priorityLabel = priorityOptions.find(
								(option) => option.value === task.priority
							)?.label;

							return (
								<TableRow
									key={task.id}
									hover
									onClick={() => onOpenTask(task)}
									sx={{ cursor: "pointer" }}
								>
									<TableCell>
										<Typography variant="body2" fontWeight={800}>
											{task.title}
										</Typography>
										<Typography variant="caption" color="text.secondary">
											Updated {formatDueDate(task.updatedAt)}
										</Typography>
									</TableCell>
									<TableCell>
										{status ? (
											<Stack direction="row" alignItems="center" gap={1}>
												<Box
													sx={{
														bgcolor: status.color,
														borderRadius: "50%",
														height: 9,
														width: 9
													}}
												/>
												<Typography variant="body2">{status.name}</Typography>
											</Stack>
										) : (
											<Typography variant="body2" color="text.secondary">
												Unknown
											</Typography>
										)}
									</TableCell>
									<TableCell>
										<Chip
											size="small"
											color={priorityColor[task.priority]}
											label={priorityLabel ?? task.priority}
											variant={task.priority === "none" ? "outlined" : "filled"}
										/>
									</TableCell>
									<TableCell>
										<Chip
											size="small"
											icon={<CalendarTodayOutlinedIcon />}
											label={formatDueDate(task.dueDate)}
											variant="outlined"
										/>
									</TableCell>
									<TableCell>
										<Stack direction="row" gap={0.5} flexWrap="wrap">
											{task.assigneeIds.length > 0 ? (
												task.assigneeIds.map((userId) => (
													<Chip
														key={userId}
														size="small"
														icon={<PersonOutlineIcon />}
														label={userName(userId, users)}
														variant="outlined"
													/>
												))
											) : (
												<Typography variant="body2" color="text.secondary">
													Unassigned
												</Typography>
											)}
										</Stack>
									</TableCell>
									<TableCell>{task.position + 1}</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</Box>
		</Paper>
	);
}
