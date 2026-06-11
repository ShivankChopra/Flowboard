import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ViewKanbanOutlinedIcon from "@mui/icons-material/ViewKanbanOutlined";
import {
	Box,
	Chip,
	Divider,
	Stack,
	Toolbar,
	Typography,
	useMediaQuery,
	useTheme,
} from "@mui/material";
import {
	useCallback,
	useState,
	type PointerEvent as ReactPointerEvent,
} from "react";
import { SidebarTree } from "../containers/SidebarTree";
import { findContainer } from "../containers/tree-utils";
import { useContainerTreeQuery } from "../containers/use-container-tree-query";
import { ListWorkspace } from "../lists/ListWorkspace";
import { UserSwitcher } from "../users/UserSwitcher";
import { useAppUi } from "../../state/app-ui-context";

export function AppShell() {
	const theme = useTheme();
	const isWide = useMediaQuery(theme.breakpoints.up("md"));
	const { selectedUserId, selectedListId } = useAppUi();
	const [sidebarWidth, setSidebarWidth] = useState(320);
	const { data: tree = [] } = useContainerTreeQuery(selectedUserId);
	const selectedList = findContainer(tree, selectedListId);
	const handleSidebarResizeStart = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			event.preventDefault();
			const startX = event.clientX;
			const startWidth = sidebarWidth;
			const previousCursor = document.body.style.cursor;
			const previousUserSelect = document.body.style.userSelect;

			document.body.style.cursor = "ew-resize";
			document.body.style.userSelect = "none";

			const handlePointerMove = (moveEvent: PointerEvent) => {
				const nextWidth = startWidth + moveEvent.clientX - startX;
				setSidebarWidth(Math.max(260, Math.min(460, nextWidth)));
			};
			const handlePointerUp = () => {
				document.body.style.cursor = previousCursor;
				document.body.style.userSelect = previousUserSelect;
				window.removeEventListener("pointermove", handlePointerMove);
				window.removeEventListener("pointerup", handlePointerUp);
			};

			window.addEventListener("pointermove", handlePointerMove);
			window.addEventListener("pointerup", handlePointerUp);
		},
		[sidebarWidth],
	);

	return (
		<Box
			sx={{
				display: "grid",
				gridTemplateColumns: isWide
					? `${sidebarWidth}px minmax(0, 1fr)`
					: "1fr",
				minHeight: "100vh",
				background:
					"linear-gradient(180deg, #fbfdff 0%, #f8fafc 48%, #f6f9fc 100%)",
			}}
		>
			<Box
				component="aside"
				sx={{
					background:
						"linear-gradient(180deg, #fbfdff 0%, #f6f9fc 100%)",
					borderColor: "divider",
					borderRight: isWide ? "1px solid" : 0,
					borderBottom: isWide ? 0 : "1px solid",
					minHeight: isWide ? "100vh" : "auto",
					p: 2,
					position: "relative",
				}}
			>
				<Box
					onPointerDown={handleSidebarResizeStart}
					sx={{
						bgcolor: "transparent",
						cursor: "ew-resize",
						display: isWide ? "block" : "none",
						insetBlock: 0,
						position: "absolute",
						right: -4,
						width: 8,
						zIndex: 2,
						"&:hover": {
							bgcolor: "rgba(37, 99, 235, 0.12)",
						},
					}}
				/>
				<Stack gap={2}>
					<Box>
						<Typography variant="h5" component="h1">
							Flowboard
						</Typography>
						<Typography variant="body2" color="text.secondary">
							Permission-filtered workspace
						</Typography>
					</Box>
					<UserSwitcher />
					<Divider />
					<SidebarTree />
				</Stack>
			</Box>
			<Box component="main" sx={{ minWidth: 0 }}>
				<Toolbar
					disableGutters
					sx={{
						background:
							"linear-gradient(180deg, #f3f7fb 0%, #eaf1f8 100%)",
						borderBottom: "1px solid",
						borderColor: "divider",
						minHeight: "64px !important",
						px: { xs: 2, md: 3 },
					}}
				>
					<Stack
						direction={{ xs: "column", sm: "row" }}
						alignItems={{ xs: "flex-start", sm: "center" }}
						justifyContent="space-between"
						gap={1}
						sx={{ width: "100%" }}
					>
						<Box sx={{ minWidth: 0 }}>
							<Typography variant="h6" component="h2" noWrap>
								{selectedList?.name ?? "Project workspace"}
							</Typography>
							<Typography
								variant="body2"
								color="text.secondary"
								noWrap
							>
								{selectedList
									? "Tasks and statuses for the selected list"
									: "Select a list in the sidebar"}
							</Typography>
						</Box>
						{selectedList ? (
							<Stack direction="row" gap={1} flexWrap="wrap">
								<Chip
									size="small"
									icon={<ViewKanbanOutlinedIcon />}
									label="List"
									color="primary"
									variant="outlined"
								/>
								{selectedList.visibility === "private" ? (
									<Chip
										size="small"
										icon={<LockOutlinedIcon />}
										label="Private"
										variant="outlined"
									/>
								) : null}
							</Stack>
						) : null}
					</Stack>
				</Toolbar>
				<Box sx={{ p: { xs: 2, md: 3 } }}>
					{selectedList ? (
						<ListWorkspace list={selectedList} />
					) : (
						<Box
							sx={{
								alignItems: "center",
								border: "1px dashed",
								borderColor: "divider",
								borderRadius: 1,
								display: "flex",
								minHeight: 280,
								justifyContent: "center",
								p: 3,
								textAlign: "center",
							}}
						>
							<Stack
								alignItems="center"
								gap={1.25}
								sx={{ maxWidth: 520 }}
							>
								<ViewKanbanOutlinedIcon
									color="primary"
									sx={{ fontSize: 32 }}
								/>
								<Typography variant="h6">
									No list selected
								</Typography>
								<Typography color="text.secondary">
									Choose a visible list from the
									permission-filtered sidebar to set the
									active workspace context.
								</Typography>
							</Stack>
						</Box>
					)}
				</Box>
			</Box>
		</Box>
	);
}
