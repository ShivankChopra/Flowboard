import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import SpaceDashboardOutlinedIcon from "@mui/icons-material/SpaceDashboardOutlined";
import ViewKanbanOutlinedIcon from "@mui/icons-material/ViewKanbanOutlined";
import WorkspacesOutlinedIcon from "@mui/icons-material/WorkspacesOutlined";
import {
	Alert,
	Box,
	Chip,
	CircularProgress,
	Collapse,
	List,
	ListItemButton,
	ListItemIcon,
	ListItemText,
	Stack,
	Tooltip,
	Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ContainerTreeNode, ContainerType } from "../../api/client";
import { useAppUi } from "../../state/app-ui-context";
import { countLists, countPrivateNodes, flattenTree, getExpandableIds } from "./tree-utils";
import { useContainerTreeQuery } from "./use-container-tree-query";

const typeIcon: Record<ContainerType, ReactNode> = {
	workspace: <WorkspacesOutlinedIcon fontSize="small" />,
	space: <SpaceDashboardOutlinedIcon fontSize="small" />,
	folder: <FolderOutlinedIcon fontSize="small" />,
	list: <ViewKanbanOutlinedIcon fontSize="small" />
};

export function SidebarTree() {
	const { selectedUserId, selectedListId, setSelectedListId } = useAppUi();
	const { data: tree = [], isError, isLoading, error } = useContainerTreeQuery(selectedUserId);
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

	useEffect(() => {
		setExpandedIds(new Set(getExpandableIds(tree)));
	}, [tree]);

	const visibleLists = useMemo(
		() => flattenTree(tree).filter((node) => node.type === "list"),
		[tree]
	);

	useEffect(() => {
		if (
			selectedListId &&
			!visibleLists.some((list) => list.id === selectedListId)
		) {
			setSelectedListId(null);
		}
	}, [selectedListId, setSelectedListId, visibleLists]);

	if (isLoading) {
		return (
			<Stack alignItems="center" gap={1.5} sx={{ py: 4 }}>
				<CircularProgress size={22} />
				<Typography variant="body2" color="text.secondary">
					Loading accessible spaces
				</Typography>
			</Stack>
		);
	}

	if (isError) {
		return (
			<Alert severity="error" sx={{ borderRadius: 1 }}>
				{error instanceof Error ? error.message : "The sidebar could not load."}
			</Alert>
		);
	}

	if (tree.length === 0) {
		return (
			<Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 1, p: 2 }}>
				<Typography variant="body2" fontWeight={700}>
					No visible containers
				</Typography>
				<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
					This user does not currently have access to any workspace items.
				</Typography>
			</Box>
		);
	}

	return (
		<Stack gap={1.5}>
			<Stack direction="row" gap={1} flexWrap="wrap">
				<Chip
					size="small"
					icon={<Inventory2OutlinedIcon />}
					label={`${countLists(tree)} lists`}
					variant="outlined"
				/>
				<Chip
					size="small"
					icon={<LockOutlinedIcon />}
					label={`${countPrivateNodes(tree)} private`}
					variant="outlined"
				/>
			</Stack>
			<List disablePadding dense>
				{tree.map((node) => (
					<ContainerNode
						key={node.id}
						node={node}
						depth={0}
						expandedIds={expandedIds}
						onToggle={(nodeId) => {
							setExpandedIds((current) => {
								const next = new Set(current);

								if (next.has(nodeId)) {
									next.delete(nodeId);
								} else {
									next.add(nodeId);
								}

								return next;
							});
						}}
					/>
				))}
			</List>
		</Stack>
	);
}

type ContainerNodeProps = {
	node: ContainerTreeNode;
	depth: number;
	expandedIds: Set<string>;
	onToggle: (nodeId: string) => void;
};

function ContainerNode({ node, depth, expandedIds, onToggle }: ContainerNodeProps) {
	const { selectedListId, setSelectedListId } = useAppUi();
	const hasChildren = node.children.length > 0;
	const expanded = expandedIds.has(node.id);
	const selected = node.type === "list" && selectedListId === node.id;

	return (
		<Box>
			<ListItemButton
				selected={selected}
				onClick={() => {
					if (node.type === "list") {
						setSelectedListId(node.id);
						return;
					}

					if (hasChildren) {
						onToggle(node.id);
					}
				}}
				sx={{
					borderRadius: 1,
					minHeight: 36,
					mb: 0.25,
					pl: 1 + depth * 1.75,
					pr: 1,
					"&.Mui-selected": {
						bgcolor: "rgba(37, 99, 235, 0.08)",
						color: "primary.main"
					}
				}}
			>
				<ListItemIcon sx={{ color: "inherit", minWidth: 28 }}>
					{hasChildren ? (
						<Box
							component="span"
							sx={{ alignItems: "center", display: "inline-flex", width: 18 }}
						>
							{expanded ? (
								<ExpandMoreIcon fontSize="small" />
							) : (
								<ChevronRightIcon fontSize="small" />
							)}
						</Box>
					) : (
						<Box component="span" sx={{ width: 18 }} />
					)}
				</ListItemIcon>
				<ListItemIcon sx={{ color: "inherit", minWidth: 28 }}>
					{typeIcon[node.type]}
				</ListItemIcon>
				<ListItemText
					primary={node.name}
					secondary={node.type}
					primaryTypographyProps={{
						fontSize: 13,
						fontWeight: selected ? 700 : 600,
						noWrap: true
					}}
					secondaryTypographyProps={{
						fontSize: 11,
						textTransform: "capitalize"
					}}
					sx={{ minWidth: 0, my: 0 }}
				/>
				{node.visibility === "private" ? (
					<Tooltip title="Private container visible to this user">
						<LockOutlinedIcon color="action" sx={{ fontSize: 14, ml: 1 }} />
					</Tooltip>
				) : null}
			</ListItemButton>
			{hasChildren ? (
				<Collapse in={expanded} timeout="auto" unmountOnExit>
					<List disablePadding dense>
						{node.children.map((child) => (
							<ContainerNode
								key={child.id}
								node={child}
								depth={depth + 1}
								expandedIds={expandedIds}
								onToggle={onToggle}
							/>
						))}
					</List>
				</Collapse>
			) : null}
		</Box>
	);
}
