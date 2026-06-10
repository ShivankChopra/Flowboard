import { Box, Link, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

type MarkdownPreviewProps = {
	value: string | null | undefined;
	emptyText?: string;
};

const inlinePattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;

export function MarkdownPreview({
	value,
	emptyText = "No description"
}: MarkdownPreviewProps) {
	const lines = (value ?? "").split("\n");

	if (!value?.trim()) {
		return (
			<Typography variant="body2" color="text.secondary">
				{emptyText}
			</Typography>
		);
	}

	return (
		<Stack gap={0.75}>
			{lines.map((line, index) => renderLine(line, index))}
		</Stack>
	);
}

function renderLine(line: string, index: number): ReactNode {
	const key = `${index}-${line}`;

	if (!line.trim()) {
		return <Box key={key} sx={{ height: 6 }} />;
	}

	if (line.startsWith("### ")) {
		return (
			<Typography key={key} variant="subtitle2" fontWeight={800}>
				{renderInline(line.slice(4))}
			</Typography>
		);
	}

	if (line.startsWith("## ")) {
		return (
			<Typography key={key} variant="subtitle1" fontWeight={800}>
				{renderInline(line.slice(3))}
			</Typography>
		);
	}

	if (line.startsWith("# ")) {
		return (
			<Typography key={key} variant="h6">
				{renderInline(line.slice(2))}
			</Typography>
		);
	}

	if (line.startsWith("- ")) {
		return (
			<Typography key={key} variant="body2" sx={{ pl: 1.5 }}>
				<Box component="span" aria-hidden="true" sx={{ mr: 0.75 }}>
					-
				</Box>
				{renderInline(line.slice(2))}
			</Typography>
		);
	}

	return (
		<Typography key={key} variant="body2">
			{renderInline(line)}
		</Typography>
	);
}

function renderInline(text: string): ReactNode[] {
	const nodes: ReactNode[] = [];
	let lastIndex = 0;

	for (const match of text.matchAll(inlinePattern)) {
		if (match.index === undefined) {
			continue;
		}

		if (match.index > lastIndex) {
			nodes.push(text.slice(lastIndex, match.index));
		}

		const token = match[0];

		if (token.startsWith("`")) {
			nodes.push(
				<Box
					key={`${match.index}-code`}
					component="code"
					sx={{
						bgcolor: "rgba(17, 24, 39, 0.08)",
						borderRadius: 0.75,
						fontFamily: "monospace",
						fontSize: "0.85em",
						px: 0.5
					}}
				>
					{token.slice(1, -1)}
				</Box>
			);
		} else if (token.startsWith("**")) {
			nodes.push(
				<Box key={`${match.index}-bold`} component="strong">
					{token.slice(2, -2)}
				</Box>
			);
		} else {
			const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);

			if (linkMatch) {
				nodes.push(
					<Link
						key={`${match.index}-link`}
						href={linkMatch[2]}
						target="_blank"
						rel="noreferrer"
					>
						{linkMatch[1]}
					</Link>
				);
			}
		}

		lastIndex = match.index + token.length;
	}

	if (lastIndex < text.length) {
		nodes.push(text.slice(lastIndex));
	}

	return nodes;
}
