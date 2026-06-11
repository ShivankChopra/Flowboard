import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import { Avatar, Box, Stack, Tooltip, Typography } from "@mui/material";
import type { TaskPriority, User } from "../../api/client";
import {
	formatDueDate,
	priorityVisuals,
	userAvatarColor,
	userInitials,
	userName
} from "./task-utils";

type PriorityBadgeProps = {
	priority: TaskPriority;
	size?: "small" | "medium";
};

export function PriorityBadge({ priority, size = "small" }: PriorityBadgeProps) {
	const visual = priorityVisuals[priority];
	const compact = size === "small";

	return (
		<Box
			component="span"
			sx={{
				alignItems: "center",
				bgcolor: visual.background,
				border: "1px solid",
				borderColor: visual.border,
				borderRadius: 1,
				color: visual.color,
				display: "inline-flex",
				fontSize: compact ? 11 : 12,
				fontWeight: 800,
				height: compact ? 24 : 28,
				letterSpacing: 0,
				lineHeight: 1,
				px: compact ? 0.75 : 1,
				textTransform: "uppercase",
				whiteSpace: "nowrap"
			}}
		>
			{visual.label}
		</Box>
	);
}

type AssigneeInitialsProps = {
	assigneeIds: string[];
	users: User[];
	size?: number;
	max?: number;
};

export function AssigneeInitials({
	assigneeIds,
	users,
	size = 28,
	max = 4
}: AssigneeInitialsProps) {
	const visibleIds = assigneeIds.slice(0, max);
	const overflow = Math.max(assigneeIds.length - visibleIds.length, 0);

	if (assigneeIds.length === 0) {
		return (
			<Typography variant="body2" color="text.secondary">
				Unassigned
			</Typography>
		);
	}

	return (
		<Stack direction="row" alignItems="center" sx={{ pl: visibleIds.length > 1 ? 0.5 : 0 }}>
			{visibleIds.map((userId, index) => (
				<Tooltip key={userId} title={userName(userId, users)}>
					<Avatar
						aria-label={userName(userId, users)}
						sx={{
							bgcolor: userAvatarColor(userId),
							border: "2px solid",
							borderColor: "background.paper",
							boxShadow: "0 1px 2px rgba(15, 23, 42, 0.16)",
							color: "#ffffff",
							fontSize: Math.max(10, Math.round(size * 0.39)),
							fontWeight: 800,
							height: size,
							ml: index === 0 ? 0 : -0.75,
							width: size
						}}
					>
						{userInitials(userId, users)}
					</Avatar>
				</Tooltip>
			))}
			{overflow > 0 ? (
				<Avatar
					sx={{
						bgcolor: "#eef2f7",
						border: "2px solid",
						borderColor: "background.paper",
						color: "text.secondary",
						fontSize: Math.max(10, Math.round(size * 0.36)),
						fontWeight: 800,
						height: size,
						ml: -0.75,
						width: size
					}}
				>
					+{overflow}
				</Avatar>
			) : null}
		</Stack>
	);
}

type DueDateMetaProps = {
	dueDate: string | null;
};

export function DueDateMeta({ dueDate }: DueDateMetaProps) {
	return (
		<Stack
			component="span"
			direction="row"
			alignItems="center"
			gap={0.5}
			sx={{
				color: dueDate ? "text.secondary" : "#98a2b3",
				fontSize: 12,
				fontWeight: 700,
				minWidth: 0
			}}
		>
			<CalendarTodayOutlinedIcon sx={{ fontSize: 15 }} />
			<Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
				{formatDueDate(dueDate)}
			</Box>
		</Stack>
	);
}
