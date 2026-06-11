CREATE INDEX "tasks_search_idx"
ON "tasks"
USING GIN (
	to_tsvector('english', coalesce("title", '') || ' ' || coalesce("description", ''))
);
