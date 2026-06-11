import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
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
	TableRow,
	TableSortLabel,
	Tooltip,
	Typography
} from "@mui/material";
import { Fragment, useState } from "react";
import type { SortDirection, Status, Task, TaskSort, User } from "../../api/client";
import { MarkdownPreview } from "./MarkdownPreview";
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
	onEditTask: (task: Task) => void;
};

export function DenseTaskList({
	statuses,
	tasks,
	users,
	sort,
	direction,
	onSort,
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
							const priorityLabel = priorityOptions.find(
								(option) => option.value === task.priority
							)?.label;
							const expanded = expandedTaskId === task.id;

							return (
								<Fragment key={task.id}>
									<TableRow
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
															<Chip
																size="small"
																color={priorityColor[task.priority]}
																label={priorityLabel ?? task.priority}
																variant={task.priority === "none" ? "outlined" : "filled"}
															/>
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
		</Paper>
	);
}
