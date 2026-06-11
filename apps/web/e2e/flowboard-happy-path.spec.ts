import { expect, type Locator, type Page, test } from "@playwright/test";

test("Alice grants Bob access, Bob creates and moves a task, Carol cannot see it", async ({
	page
}) => {
	const suffix = Date.now().toString();
	const spaceName = `E2E Space ${suffix}`;
	const folderName = `E2E Folder ${suffix}`;
	const listName = `E2E List ${suffix}`;
	const taskTitle = `E2E Task ${suffix}`;

	await page.goto("/");
	await selectUser(page, "Alice Morgan");

	await createPrivateContainer(page, "Flowboard Workspace", "space", spaceName);
	await createPrivateContainer(page, spaceName, "folder", folderName);
	await createPrivateContainer(page, folderName, "list", listName);

	await selectUser(page, "Bob Chen");
	await expect(containerNode(page, spaceName)).toBeVisible();
	await expect(containerNode(page, folderName)).toBeVisible();
	await expect(containerNode(page, listName)).toBeVisible();

	await containerNode(page, listName).click();
	await page.getByRole("button", { name: "New task" }).first().click();

	const createTaskHeading = page.getByRole("heading", { name: "Create task" });
	await expect(createTaskHeading).toBeVisible();
	await page.getByLabel("Title").fill(taskTitle);
	await page.getByRole("button", { name: "Create" }).click();
	await expect(createTaskHeading).toBeHidden();

	await editTaskFromList(page, taskTitle);

	const editTaskHeading = page.getByRole("heading", { name: "Edit task" });
	await expect(editTaskHeading).toBeVisible();
	await chooseMuiOption(page.getByLabel("Status"), "In Progress");
	await page.getByRole("button", { name: "Save" }).click();
	await expect(editTaskHeading).toBeHidden();

	await page.getByRole("button", { name: "Board", exact: true }).click();
	await expect(
		page
			.getByTestId("kanban-column-in_progress")
			.getByTestId("task-card")
			.filter({ hasText: taskTitle })
	).toBeVisible();

	await selectUser(page, "Carol Diaz");
	await expect(containerNode(page, spaceName)).toHaveCount(0);
});

async function selectUser(page: Page, userName: string) {
	await page.getByTestId("user-switcher").click();
	await page.getByRole("option", { name: new RegExp(userName) }).click();
	await expect(page.getByText(`X-User-Id: ${userIdForName(userName)}`)).toBeVisible();
}

async function createPrivateContainer(
	page: Page,
	parentName: string,
	childType: "space" | "folder" | "list",
	name: string
) {
	await page
		.getByRole("button", {
			name: `Create ${childType} under ${parentName}`
		})
		.click();

	const dialog = page.getByRole("dialog", {
		name: `Create ${childType}`
	});
	await dialog.getByLabel("Name").fill(name);
	await chooseMuiOption(dialog.getByLabel("Visibility"), "Private");
	await dialog.getByLabel("Bob Chen (bob)").check();
	await dialog.getByRole("button", { name: "Create" }).click();
	await expect(dialog).toBeHidden();
	await expect(containerNode(page, name)).toBeVisible();
}

async function editTaskFromList(page: Page, taskTitle: string) {
	const row = page.getByTestId("task-row").filter({ hasText: taskTitle });

	await expect(row).toBeVisible();
	await row.getByRole("button", { name: `Edit task ${taskTitle}` }).click();
}

async function chooseMuiOption(select: Locator, optionName: string) {
	await select.click();
	await select.page().getByRole("option", { name: optionName }).click();
}

function containerNode(page: Page, name: string) {
	return page.getByTestId("container-node").filter({ hasText: name });
}

function userIdForName(userName: string) {
	if (userName.includes("Alice")) {
		return "alice";
	}

	if (userName.includes("Bob")) {
		return "bob";
	}

	return "carol";
}
