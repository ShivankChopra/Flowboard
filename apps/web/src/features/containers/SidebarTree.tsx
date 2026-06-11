import AddIcon from "@mui/icons-material/Add";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FolderIcon from "@mui/icons-material/Folder";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LockOutlinedIcon from "@mui/icons-material/Lock";
import SettingsIcon from "@mui/icons-material/Settings";
import SpaceDashboardIcon from "@mui/icons-material/SpaceDashboard";
import ViewKanbanIcon from "@mui/icons-material/FormatListBulletedOutlined";
import WorkspacesIcon from "@mui/icons-material/Workspaces";
import {
	Alert,
	Box,
	Button,
	Chip,
	CircularProgress,
	Collapse,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	FormControlLabel,
	IconButton,
	List,
	ListItemButton,
	ListItemIcon,
	ListItemText,
	Stack,
	Switch,
	Tooltip,
	Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import {
	listUsers,
	reorderContainer,
	type ContainerTreeNode,
	type ContainerType,
	type ReorderContainerPayload,
} from "../../api/client";
import { useAppUi } from "../../state/app-ui-context";
import { errorMessage } from "../tasks/task-utils";
import { ContainerAdminDialog } from "./ContainerAdminDialog";
import { ContainerCreateDialog } from "./ContainerCreateDialog";
import {
	countLists,
	countPrivateNodes,
	countWorkspaces,
	findContainer,
	flattenTree,
	getExpandableIds,
} from "./tree-utils";
import { useContainerTreeQuery } from "./use-container-tree-query";

const typeIcon: Record<ContainerType, ReactNode> = {
	workspace: <WorkspacesIcon fontSize="small" />,
	space: <SpaceDashboardIcon fontSize="small" />,
	folder: <FolderIcon fontSize="small" />,
	list: <ViewKanbanIcon fontSize="small" />,
};

const typeIconColor: Record<ContainerType, string> = {
	workspace: "#1976D2",
	space: "#2E7D32",
	folder: "#F59E0B",
	list: "#454674",
};

const childTypeByParentType: Partial<
	Record<ContainerType, Exclude<ContainerType, "workspace">>
> = {
	workspace: "space",
	space: "folder",
	folder: "list",
};

const parentTypeByChildType: Partial<Record<ContainerType, ContainerType>> = {
	space: "workspace",
	folder: "space",
	list: "folder",
};

type DropPosition = "before" | "after" | "inside";

type DraggingContainer = {
	id: string;
};

type DropTarget = {
	nodeId: string;
	position: DropPosition;
};

type ContainerMove = {
	dragged: ContainerTreeNode;
	payload: ReorderContainerPayload;
	targetParent: ContainerTreeNode;
};

export function SidebarTree() {
	const { selectedUserId, selectedListId, setSelectedListId } = useAppUi();
	const queryClient = useQueryClient();
	const { data: users = [] } = useQuery({
		queryKey: ["users", selectedUserId],
		queryFn: ({ signal }) => listUsers(selectedUserId, signal),
		staleTime: 60_000,
	});
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
	const [adminContainer, setAdminContainer] =
		useState<ContainerTreeNode | null>(null);
	const [createParent, setCreateParent] = useState<ContainerTreeNode | null>(
		null,
	);
	const [showArchived, setShowArchived] = useState(false);
	const [dragging, setDragging] = useState<DraggingContainer | null>(null);
	const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
	const [pendingPrivateMove, setPendingPrivateMove] =
		useState<ContainerMove | null>(null);
	const [moveError, setMoveError] = useState<string | null>(null);
	const selectedUser = users.find((user) => user.id === selectedUserId);
	const isAdmin = selectedUser?.role === "admin";
	const includeArchived = isAdmin && showArchived;
	const {
		data: tree = [],
		isError,
		isLoading,
		error,
	} = useContainerTreeQuery(selectedUserId, includeArchived);
	const moveMutation = useMutation({
		mutationFn: (move: ContainerMove) =>
			reorderContainer(selectedUserId, move.dragged.id, move.payload),
		onSuccess: () => {
			setMoveError(null);
			setPendingPrivateMove(null);
			void queryClient.invalidateQueries({
				queryKey: ["containers", "tree"],
			});
		},
		onError: (mutationError) => {
			setMoveError(
				errorMessage(mutationError, "Container could not be moved."),
			);
			setPendingPrivateMove(null);
			void queryClient.invalidateQueries({
				queryKey: ["containers", "tree"],
			});
		},
	});

	useEffect(() => {
		setExpandedIds(new Set(getExpandableIds(tree)));
	}, [tree]);

	useEffect(() => {
		if (!adminContainer) {
			return;
		}

		const updatedContainer = findContainer(tree, adminContainer.id);

		if (!updatedContainer) {
			setAdminContainer(null);
			return;
		}

		if (updatedContainer !== adminContainer) {
			setAdminContainer(updatedContainer);
		}
	}, [adminContainer, tree]);

	const visibleLists = useMemo(
		() => flattenTree(tree).filter((node) => node.type === "list"),
		[tree],
	);

	function executeMove(move: ContainerMove) {
		setMoveError(null);

		if (moveNeedsPrivateConfirmation(tree, move)) {
			setPendingPrivateMove(move);
			return;
		}

		moveMutation.mutate(move);
	}

	function handleDragStart(
		event: DragEvent<HTMLElement>,
		node: ContainerTreeNode,
	) {
		if (!isAdmin || node.type === "workspace" || node.isArchived) {
			return;
		}

		event.stopPropagation();
		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData("text/plain", node.id);
		setMoveError(null);
		setDragging({ id: node.id });
	}

	function handleDragOver(
		event: DragEvent<HTMLElement>,
		node: ContainerTreeNode,
	) {
		if (!dragging || moveMutation.isPending) {
			return;
		}

		const position = pickDropPosition(event, tree, dragging.id, node.id);
		const move = buildContainerMove(tree, dragging.id, node.id, position);

		if (!move) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		event.dataTransfer.dropEffect = "move";
		setDropTarget({
			nodeId: node.id,
			position,
		});
	}

	function handleDrop(event: DragEvent<HTMLElement>, node: ContainerTreeNode) {
		if (!dragging || moveMutation.isPending) {
			return;
		}

		const position = pickDropPosition(event, tree, dragging.id, node.id);
		const move = buildContainerMove(tree, dragging.id, node.id, position);

		setDragging(null);
		setDropTarget(null);

		if (!move) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		executeMove(move);
	}

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
				{error instanceof Error
					? error.message
					: "The sidebar could not load."}
			</Alert>
		);
	}

	return (
		<Stack gap={1.5}>
			<Stack direction="row" gap={1} flexWrap="wrap">
				<Chip
					size="small"
					icon={<WorkspacesIcon />}
					label={`${countWorkspaces(tree)} workspace${countWorkspaces(tree) === 1 ? "" : "s"}`}
					variant="outlined"
				/>
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
			{isAdmin ? (
				<FormControlLabel
					control={
						<Switch
							size="small"
							checked={showArchived}
							onChange={(event) =>
								setShowArchived(event.target.checked)
							}
						/>
					}
					label="Show archived"
					sx={{
						color: "text.secondary",
						m: 0,
						"& .MuiFormControlLabel-label": {
							fontSize: 13,
						},
					}}
				/>
			) : null}
			{moveError ? (
				<Alert
					severity="error"
					onClose={() => setMoveError(null)}
					sx={{ borderRadius: 1 }}
				>
					{moveError}
				</Alert>
			) : null}
			{tree.length === 0 ? (
				<Box
					sx={{
						border: "1px dashed",
						borderColor: "divider",
						borderRadius: 1,
						p: 2,
					}}
				>
					<Typography variant="body2" fontWeight={700}>
						No visible containers
					</Typography>
					<Typography
						variant="body2"
						color="text.secondary"
						sx={{ mt: 0.5 }}
					>
						This user does not currently have access to any
						workspace items.
					</Typography>
				</Box>
			) : (
				<List disablePadding dense>
					{tree.map((node) => (
						<ContainerNode
							key={node.id}
							node={node}
							depth={0}
							expandedIds={expandedIds}
							isAdmin={isAdmin}
							draggingId={dragging?.id ?? null}
							dropTarget={dropTarget}
							isMoving={moveMutation.isPending}
							onCreateChild={setCreateParent}
							onDragEnd={() => {
								setDragging(null);
								setDropTarget(null);
							}}
							onDragOver={handleDragOver}
							onDragStart={handleDragStart}
							onDrop={handleDrop}
							onOpenAdmin={setAdminContainer}
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
			)}
			<ContainerAdminDialog
				open={Boolean(adminContainer)}
				container={adminContainer}
				currentUserId={selectedUserId}
				users={users}
				onClose={() => setAdminContainer(null)}
			/>
			<ContainerCreateDialog
				open={Boolean(createParent)}
				parent={createParent}
				childType={
					createParent
						? (childTypeByParentType[createParent.type] ?? null)
						: null
				}
				currentUserId={selectedUserId}
				users={users}
				onClose={() => setCreateParent(null)}
			/>
			<Dialog
				open={Boolean(pendingPrivateMove)}
				onClose={() => {
					if (!moveMutation.isPending) {
						setPendingPrivateMove(null);
					}
				}}
				fullWidth
				maxWidth="xs"
			>
				<DialogTitle>Move into private scope?</DialogTitle>
				<DialogContent>
					<Typography variant="body2" color="text.secondary">
						{pendingPrivateMove
							? `"${pendingPrivateMove.dragged.name}" and its descendants will become private. Existing grants stay unchanged.`
							: null}
					</Typography>
				</DialogContent>
				<DialogActions>
					<Button
						onClick={() => setPendingPrivateMove(null)}
						disabled={moveMutation.isPending}
					>
						Cancel
					</Button>
					<Button
						variant="contained"
						disabled={!pendingPrivateMove || moveMutation.isPending}
						onClick={() => {
							if (pendingPrivateMove) {
								moveMutation.mutate(pendingPrivateMove);
							}
						}}
					>
						Move
					</Button>
				</DialogActions>
			</Dialog>
		</Stack>
	);
}

type ContainerNodeProps = {
	node: ContainerTreeNode;
	depth: number;
	expandedIds: Set<string>;
	isAdmin: boolean;
	draggingId: string | null;
	dropTarget: DropTarget | null;
	isMoving: boolean;
	onCreateChild: (node: ContainerTreeNode) => void;
	onDragEnd: () => void;
	onDragOver: (
		event: DragEvent<HTMLElement>,
		node: ContainerTreeNode,
	) => void;
	onDragStart: (
		event: DragEvent<HTMLElement>,
		node: ContainerTreeNode,
	) => void;
	onDrop: (event: DragEvent<HTMLElement>, node: ContainerTreeNode) => void;
	onOpenAdmin: (node: ContainerTreeNode) => void;
	onToggle: (nodeId: string) => void;
};

function ContainerNode({
	node,
	depth,
	expandedIds,
	isAdmin,
	draggingId,
	dropTarget,
	isMoving,
	onCreateChild,
	onDragEnd,
	onDragOver,
	onDragStart,
	onDrop,
	onOpenAdmin,
	onToggle,
}: ContainerNodeProps) {
	const { selectedListId, setSelectedListId } = useAppUi();
	const hasChildren = node.children.length > 0;
	const childType = childTypeByParentType[node.type];
	const expanded = expandedIds.has(node.id);
	const selected = node.type === "list" && selectedListId === node.id;
	const activeDropPosition =
		dropTarget?.nodeId === node.id ? dropTarget.position : null;
	const dragging = draggingId === node.id;
	const canDrag =
		isAdmin && node.type !== "workspace" && !node.isArchived && !isMoving;

	return (
		<Box>
			<ListItemButton
				selected={selected}
				onDragOver={(event) => onDragOver(event, node)}
				onDrop={(event) => onDrop(event, node)}
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
					borderBottom: "2px solid transparent",
					borderTop: "2px solid transparent",
					borderBottomColor:
						activeDropPosition === "after"
							? "primary.main"
							: "transparent",
					borderTopColor:
						activeDropPosition === "before"
							? "primary.main"
							: "transparent",
					borderRadius: 1,
					boxShadow:
						activeDropPosition === "inside"
							? "inset 0 0 0 1px rgba(37, 99, 235, 0.55)"
							: "none",
					minHeight: 36,
					mb: 0.25,
					pl: 1 + depth * 1.75,
					pr: 1,
					"&.Mui-selected": {
						bgcolor: "rgba(37, 99, 235, 0.08)",
						color: "primary.main",
					},
					opacity: node.isArchived || dragging ? 0.62 : 1,
				}}
			>
				<ListItemIcon sx={{ color: "inherit", minWidth: 28 }}>
					{hasChildren ? (
						<Box
							component="span"
							sx={{
								alignItems: "center",
								display: "inline-flex",
								width: 18,
							}}
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
				<ListItemIcon
					sx={{ color: typeIconColor[node.type], minWidth: 28 }}
				>
					{typeIcon[node.type]}
				</ListItemIcon>
				<ListItemText
					primary={node.name}
					secondary={node.type}
					primaryTypographyProps={{
						fontSize: 13,
						fontWeight: selected ? 700 : 600,
						noWrap: true,
					}}
					secondaryTypographyProps={{
						fontSize: 11,
						textTransform: "capitalize",
					}}
					sx={{ minWidth: 0, my: 0 }}
				/>
				{node.visibility === "private" ? (
					<Tooltip title={`Private ${node.type}`}>
						<LockOutlinedIcon
							color="action"
							sx={{ fontSize: 14, ml: 1 }}
						/>
					</Tooltip>
				) : null}
				{node.isArchived ? (
					<Chip
						size="small"
						label="Archived"
						variant="outlined"
						sx={{ height: 20, ml: 0.75 }}
					/>
				) : null}
				{isAdmin ? (
					<>
						{node.type !== "workspace" ? (
							<Tooltip title="Drag to move">
								<Box
									component="span"
									draggable={canDrag}
									onClick={(event) =>
										event.stopPropagation()
									}
									onDragEnd={onDragEnd}
									onDragStart={(event) =>
										onDragStart(event, node)
									}
									sx={{
										alignItems: "center",
										color: "text.secondary",
										cursor: canDrag ? "grab" : "default",
										display: "inline-flex",
										ml: 0.5,
										opacity: canDrag ? 0.72 : 0.28,
										"&:active": {
											cursor: canDrag
												? "grabbing"
												: "default",
										},
									}}
								>
									<DragIndicatorIcon sx={{ fontSize: 16 }} />
								</Box>
							</Tooltip>
						) : null}
						{childType && !node.isArchived ? (
							<Tooltip
								title={`Create ${childType} under ${node.name}`}
							>
								<IconButton
									edge="end"
									size="small"
									onClick={(event) => {
										event.stopPropagation();
										onCreateChild(node);
									}}
									sx={{
										color: "#2E7D32",
										ml: 0.5,
										"&:hover": {
											bgcolor: "rgba(46, 125, 50, 0.1)",
											color: "#1B5E20",
										},
									}}
								>
									<AddIcon sx={{ fontSize: 18 }} />
								</IconButton>
							</Tooltip>
						) : null}
						<Tooltip title={`Admin settings for ${node.name}`}>
							<IconButton
								edge="end"
								size="small"
								onClick={(event) => {
									event.stopPropagation();
									onOpenAdmin(node);
								}}
								sx={{ ml: 0.25 }}
							>
								<SettingsIcon
									sx={{ fontSize: 16, color: "#353c5d" }}
								/>
							</IconButton>
						</Tooltip>
					</>
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
								isAdmin={isAdmin}
								draggingId={draggingId}
								dropTarget={dropTarget}
								isMoving={isMoving}
								onCreateChild={onCreateChild}
								onDragEnd={onDragEnd}
								onDragOver={onDragOver}
								onDragStart={onDragStart}
								onDrop={onDrop}
								onOpenAdmin={onOpenAdmin}
								onToggle={onToggle}
							/>
						))}
					</List>
				</Collapse>
			) : null}
		</Box>
	);
}

function pickDropPosition(
	event: DragEvent<HTMLElement>,
	tree: ContainerTreeNode[],
	draggedId: string,
	targetId: string,
): DropPosition {
	const bounds = event.currentTarget.getBoundingClientRect();
	const ratio =
		bounds.height > 0 ? (event.clientY - bounds.top) / bounds.height : 0.5;
	const preferred: DropPosition =
		ratio < 0.28 ? "before" : ratio > 0.72 ? "after" : "inside";
	const fallback = ratio < 0.5 ? "before" : "after";
	const positions = uniquePositions([
		preferred,
		"inside",
		fallback,
		fallback === "before" ? "after" : "before",
	]);

	return (
		positions.find((position) =>
			Boolean(buildContainerMove(tree, draggedId, targetId, position)),
		) ?? preferred
	);
}

function uniquePositions(positions: DropPosition[]): DropPosition[] {
	return positions.filter(
		(position, index) => positions.indexOf(position) === index,
	);
}

function buildContainerMove(
	tree: ContainerTreeNode[],
	draggedId: string,
	targetId: string,
	position: DropPosition,
): ContainerMove | null {
	const dragged = findContainer(tree, draggedId);
	const target = findContainer(tree, targetId);

	if (
		!dragged ||
		!target ||
		dragged.id === target.id ||
		dragged.type === "workspace"
	) {
		return null;
	}

	if (position === "inside") {
		return buildInsideMove(dragged, target);
	}

	return buildSiblingMove(tree, dragged, target, position);
}

function buildInsideMove(
	dragged: ContainerTreeNode,
	targetParent: ContainerTreeNode,
): ContainerMove | null {
	if (
		childTypeByParentType[targetParent.type] !== dragged.type ||
		isDescendantOf(dragged, targetParent.id)
	) {
		return null;
	}

	const orderedIds = [
		...targetParent.children
			.map((child) => child.id)
			.filter((childId) => childId !== dragged.id),
		dragged.id,
	];

	if (
		dragged.parentId === targetParent.id &&
		orderedIds.join("|") ===
			targetParent.children.map((child) => child.id).join("|")
	) {
		return null;
	}

	return {
		dragged,
		payload: {
			parentId: targetParent.id,
			orderedIds,
		},
		targetParent,
	};
}

function buildSiblingMove(
	tree: ContainerTreeNode[],
	dragged: ContainerTreeNode,
	target: ContainerTreeNode,
	position: Exclude<DropPosition, "inside">,
): ContainerMove | null {
	if (dragged.type !== target.type || !target.parentId) {
		return null;
	}

	const expectedParentType = parentTypeByChildType[dragged.type];
	const targetParent = findContainer(tree, target.parentId);

	if (
		!targetParent ||
		targetParent.type !== expectedParentType ||
		isDescendantOf(dragged, targetParent.id)
	) {
		return null;
	}

	const siblingIds = targetParent.children
		.map((child) => child.id)
		.filter((childId) => childId !== dragged.id);
	const targetIndex = siblingIds.indexOf(target.id);

	if (targetIndex === -1) {
		return null;
	}

	const insertIndex = position === "before" ? targetIndex : targetIndex + 1;
	const orderedIds = [...siblingIds];
	orderedIds.splice(insertIndex, 0, dragged.id);

	if (
		dragged.parentId === targetParent.id &&
		orderedIds.join("|") ===
			targetParent.children.map((child) => child.id).join("|")
	) {
		return null;
	}

	return {
		dragged,
		payload: {
			parentId: targetParent.id,
			orderedIds,
		},
		targetParent,
	};
}

function isDescendantOf(node: ContainerTreeNode, candidateId: string): boolean {
	return node.children.some(
		(child) =>
			child.id === candidateId || isDescendantOf(child, candidateId),
	);
}

function moveNeedsPrivateConfirmation(
	tree: ContainerTreeNode[],
	move: ContainerMove,
): boolean {
	if (!subtreeHasPublicContainer(move.dragged)) {
		return false;
	}

	return pathToContainer(tree, move.targetParent.id).some(
		(container) => container.visibility === "private",
	);
}

function subtreeHasPublicContainer(node: ContainerTreeNode): boolean {
	return (
		node.visibility === "public" ||
		node.children.some((child) => subtreeHasPublicContainer(child))
	);
}

function pathToContainer(
	nodes: ContainerTreeNode[],
	containerId: string,
): ContainerTreeNode[] {
	for (const node of nodes) {
		if (node.id === containerId) {
			return [node];
		}

		const childPath = pathToContainer(node.children, containerId);

		if (childPath.length > 0) {
			return [node, ...childPath];
		}
	}

	return [];
}
