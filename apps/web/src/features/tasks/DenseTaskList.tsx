import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import {
	Box,
	Chip,
	Collapse,
	IconButton,
	Paper,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TablePagination,
	TableRow,
	TableSortLabel,
	Tooltip,
	Typography
} from "@mui/material";
import { Fragment, useState } from "react";
import type { SortDirection, Status, Task, TaskSort, User } from "../../api/client";
import { MarkdownPreview } from "./MarkdownPreview";
import { AssigneeInitials, PriorityBadge } from "./TaskMetadata";
import {
	formatDueDate,
} from "./task-utils";

type DenseTaskListProps = {
	statuses: Status[];
	tasks: Task[];
	users: User[];
	sort: TaskSort;
	direction: SortDirection;
	count: number;
	page: number;
	rowsPerPage: number;
	onSort: (sort: TaskSort) => void;
	onPageChange: (page: number) => void;
	onRowsPerPageChange: (rowsPerPage: number) => void;
	onEditTask: (task: Task) => void;
};

export function DenseTaskList({
	statuses,
	tasks,
	users,
	sort,
	direction,
	count,
	page,
	rowsPerPage,
	onSort,
	onPageChange,
	onRowsPerPageChange,
	onEditTask
}: DenseTaskListProps) {
	const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
	const statusById = new Map(statuses.map((status) => [status.id, status]));

	return (
		<Paper
			variant="outlined"
			sx={{
				display: "flex",
				flexDirection: "column",
				maxHeight: { xs: "none", md: "calc(100vh - 250px)" },
				overflow: "hidden"
			}}
		>
			<Box sx={{ minHeight: 0, overflow: "auto" }}>
				<Table size="small" sx={{ minWidth: 760 }}>
					<TableHead
						sx={{
							"& th": {
								bgcolor: "background.paper",
								position: "sticky",
								top: 0,
								zIndex: 1
							}
						}}
					>
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
						</TableRow>
					</TableHead>
					<TableBody>
						{tasks.map((task) => {
							const status = statusById.get(task.statusId);
							const expanded = expandedTaskId === task.id;

							return (
								<Fragment key={task.id}>
									<TableRow
										data-testid="task-row"
										hover
										onClick={() =>
											setExpandedTaskId((current) =>
												current === task.id ? null : task.id
											)
										}
										sx={{ cursor: "pointer" }}
									>
										<TableCell>
											<Stack direction="row" alignItems="center" gap={0.75}>
												{expanded ? (
													<KeyboardArrowDownIcon color="action" fontSize="small" />
												) : (
													<KeyboardArrowRightIcon color="action" fontSize="small" />
												)}
												<Box sx={{ minWidth: 0 }}>
													<Stack direction="row" alignItems="center" gap={0.5}>
														<Typography variant="body2" fontWeight={800} noWrap>
															{task.title}
														</Typography>
														<Tooltip title="Edit task">
															<IconButton
																aria-label={`Edit task ${task.title}`}
																size="small"
																onClick={(event) => {
																	event.stopPropagation();
																	onEditTask(task);
																}}
																sx={{
																	bgcolor: "rgba(37, 99, 235, 0.1)",
																	border: "1px solid",
																	borderColor: "rgba(37, 99, 235, 0.28)",
																	borderRadius: 1,
																	color: "primary.main",
																	height: 26,
																	ml: 0.5,
																	width: 26,
																	"&:hover": {
																		bgcolor: "rgba(37, 99, 235, 0.18)",
																		borderColor: "primary.main"
																	}
																}}
															>
																<EditOutlinedIcon sx={{ fontSize: 15 }} />
															</IconButton>
														</Tooltip>
													</Stack>
													<Typography variant="caption" color="text.secondary">
														Updated {formatDueDate(task.updatedAt)}
													</Typography>
												</Box>
											</Stack>
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
											<PriorityBadge priority={task.priority} />
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
											<AssigneeInitials
												assigneeIds={task.assigneeIds}
												users={users}
												size={26}
												max={4}
											/>
										</TableCell>
									</TableRow>
									<TableRow>
										<TableCell colSpan={5} sx={{ p: 0 }}>
											<Collapse in={expanded} timeout="auto" unmountOnExit>
												<Box
													sx={{
														bgcolor: "rgba(17, 24, 39, 0.025)",
														borderTop: "1px solid",
														borderColor: "divider",
														p: 2
													}}
												>
													<Stack gap={1.5}>
														<Stack direction="row" gap={0.75} flexWrap="wrap">
															{status ? (
																<Chip
																	size="small"
																	label={status.name}
																	variant="outlined"
																	sx={{
																		borderColor: status.color,
																		color: "text.primary"
																	}}
																/>
															) : null}
															<PriorityBadge priority={task.priority} />
															<Chip
																size="small"
																icon={<CalendarTodayOutlinedIcon />}
																label={formatDueDate(task.dueDate)}
																variant="outlined"
															/>
														</Stack>
														<Box
															sx={{
																border: "1px solid",
																borderColor: "divider",
																borderRadius: 1,
																bgcolor: "background.paper",
																p: 1.5
															}}
														>
															<MarkdownPreview value={task.description} />
														</Box>
													</Stack>
												</Box>
											</Collapse>
										</TableCell>
									</TableRow>
								</Fragment>
							);
						})}
					</TableBody>
				</Table>
			</Box>
			<TablePagination
				component="div"
				count={count}
				page={page}
				rowsPerPage={rowsPerPage}
				rowsPerPageOptions={[5, 10, 25, 50]}
				onPageChange={(_, nextPage) => onPageChange(nextPage)}
				onRowsPerPageChange={(event) =>
					onRowsPerPageChange(Number(event.target.value))
				}
				sx={{
					borderTop: "1px solid",
					borderColor: "divider",
					flexShrink: 0
				}}
			/>
		</Paper>
	);
}
