import React from "react";
import { callNotionApi } from "../../../../utils/api";

const notionTool = {
  id: "notion",
  name: "Notion",
  icon: (
    <img
      src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Notion-logo.svg/2048px-Notion-logo.svg.png"
      alt="Notion"
      style={{ width: "16px", height: "16px" }}
    />
  ),
  description: "Create tasks and pages in Notion",
};

const createNotionDatabase = async (
  notionConfigured,
  notionDatabaseId,
  addMessage
) => {
  if (!notionConfigured) {
    addMessage(
      "assistant",
      "❌ Notion API key is not configured. Please add it in Settings."
    );
    return null;
  }

  try {
    if (notionDatabaseId) {
      addMessage(
        "system",
        "🔄 Verifying connection to existing Notion database..."
      );

      try {
        await callNotionApi(`databases/${notionDatabaseId}`, { method: "GET" });
        addMessage(
          "assistant",
          "✅ Successfully connected to existing Notion database."
        );
        return notionDatabaseId;
      } catch {
        addMessage(
          "assistant",
          "⚠️ The specified database ID does not exist or is not shared with your integration. Creating a new database..."
        );
      }
    }

    addMessage(
      "system",
      "🔄 Creating a new Notion database for mind map actions..."
    );

    const searchData = await callNotionApi("search", {
      method: "POST",
      body: {
        filter: {
          property: "object",
          value: "page",
        },
        page_size: 1,
      },
    });

    let parentId = null;

    if (searchData.results && searchData.results.length > 0) {
      parentId = searchData.results[0].id;
    } else {
      addMessage(
        "system",
        "🔄 No existing pages found. Creating a new page as parent..."
      );

      const pageData = await callNotionApi("pages", {
        method: "POST",
        body: {
          parent: {
            type: "workspace_id",
            workspace_id: "default",
          },
          properties: {
            title: {
              title: [
                {
                  text: {
                    content: "Mind Map Workspace",
                  },
                },
              ],
            },
          },
        },
      });

      parentId = pageData.id;
    }

    const data = await callNotionApi("databases", {
      method: "POST",
      body: {
        parent: {
          type: "page_id",
          page_id: parentId,
        },
        title: [
          {
            type: "text",
            text: {
              content: "Mind Map Actions",
            },
          },
        ],
        properties: {
          Name: { title: {} },
          Status: {
            select: {
              options: [
                { name: "Not started", color: "red" },
                { name: "In progress", color: "yellow" },
                { name: "Completed", color: "green" },
              ],
            },
          },
          Priority: {
            select: {
              options: [
                { name: "High", color: "red" },
                { name: "Medium", color: "yellow" },
                { name: "Low", color: "blue" },
              ],
            },
          },
          Category: { select: { options: [] } },
          DueDate: { date: {} },
          Notes: { rich_text: {} },
        },
      },
    });

    addMessage(
      "assistant",
      "✅ Successfully created a new Notion database for mind map actions."
    );

    return data.id;
  } catch (error) {
    console.error("Error with Notion database:", error);
    addMessage("assistant", `❌ Error with Notion: ${error.message}`);
    return null;
  }
};

const createNotionPage = async (
  notionConfigured,
  notionDatabaseId,
  title,
  properties,
  addMessage
) => {
  if (!notionConfigured) {
    addMessage(
      "assistant",
      "❌ Notion is not configured. Please add your API key in Settings."
    );
    return null;
  }

  try {
    addMessage("system", `🔄 Creating Notion page: "${title}"...`);

    const requestBody = {
      properties: {
        Name: {
          title: [
            {
              text: {
                content: title,
              },
            },
          ],
        },
        ...properties,
      },
    };

    if (notionDatabaseId) {
      requestBody.parent = {
        type: "database_id",
        database_id: notionDatabaseId,
      };
    }

    const data = await callNotionApi("pages", {
      method: "POST",
      body: requestBody,
    });

    addMessage("assistant", `✅ Successfully created Notion page: "${title}"`);
    return data.id;
  } catch (error) {
    console.error("Error creating Notion page:", error);
    addMessage("assistant", `❌ Error creating Notion page: ${error.message}`);
    return null;
  }
};

const updateNotionPage = async (
  notionConfigured,
  pageId,
  properties,
  addMessage
) => {
  if (!notionConfigured) {
    addMessage(
      "assistant",
      "❌ Notion is not configured. Please add your API key in Settings."
    );
    return null;
  }

  try {
    addMessage(
      "system",
      `🔄 Updating Notion page: "${
        properties.Name?.title?.[0]?.text?.content || "Untitled"
      }"...`
    );

    const data = await callNotionApi(`pages/${pageId}`, {
      method: "PATCH",
      body: { properties },
    });

    addMessage("assistant", "✅ Successfully updated Notion page.");
    return data.id;
  } catch (error) {
    console.error("Error updating Notion page:", error);
    addMessage("assistant", `❌ Error updating Notion page: ${error.message}`);
    return null;
  }
};

const deleteNotionPage = async (notionConfigured, pageId, addMessage) => {
  if (!notionConfigured) {
    addMessage(
      "assistant",
      "❌ Notion is not configured. Please add your API key in Settings."
    );
    return false;
  }

  try {
    addMessage("system", "🔄 Deleting Notion page...");

    await callNotionApi(`pages/${pageId}`, {
      method: "PATCH",
      body: { archived: true },
    });

    addMessage("assistant", "✅ Successfully deleted Notion page.");
    return true;
  } catch (error) {
    console.error("Error deleting Notion page:", error);
    addMessage("assistant", `❌ Error deleting Notion page: ${error.message}`);
    return false;
  }
};

const fetchNotionDatabaseContent = async (
  notionConfigured,
  notionDatabaseId,
  addMessage
) => {
  if (!notionConfigured || !notionDatabaseId) {
    return null;
  }

  try {
    addMessage("system", "🔄 Fetching latest Notion database content...");

    const data = await callNotionApi(`databases/${notionDatabaseId}/query`, {
      method: "POST",
      body: { page_size: 100 },
    });

    const pages = data.results.map((page) => {
      const title =
        page.properties.Name?.title?.[0]?.text?.content || "Untitled";
      const status = page.properties.Status?.select?.name || "Not started";
      const priority = page.properties.Priority?.select?.name || "Medium";
      const category = page.properties.Category?.select?.name || "General";

      return {
        id: page.id,
        title,
        status,
        priority,
        category,
        url: page.url,
      };
    });

    addMessage(
      "assistant",
      `✅ Retrieved ${pages.length} items from Notion database.`
    );

    return pages;
  } catch (error) {
    console.error("Error fetching Notion database content:", error);
    addMessage(
      "assistant",
      `❌ Error fetching Notion database content: ${error.message}`
    );
    return null;
  }
};

const createNotionWebhook = async (
  notionConfigured,
  notionDatabaseId,
  addMessage
) => {
  if (!notionConfigured || !notionDatabaseId) {
    addMessage(
      "assistant",
      "❌ Notion configuration is incomplete. Please check Settings."
    );
    return null;
  }

  try {
    addMessage("system", "🔄 Setting up Notion webhook subscription...");
    addMessage(
      "assistant",
      "✅ Webhook setup would be handled by a server-side implementation."
    );
    localStorage.setItem("notionWebhookId", "webhook-placeholder");
    return "webhook-placeholder";
  } catch (error) {
    console.error("Error creating Notion webhook:", error);
    addMessage(
      "assistant",
      `❌ Error setting up Notion webhook: ${error.message}`
    );
    return null;
  }
};

const parseActionItems = (actionPlan) => {
  const lines = actionPlan.split("\n");
  const items = [];
  let currentBranch = "";

  for (const line of lines) {
    if (line.startsWith("### ")) {
      currentBranch = line.replace("### ", "").trim();
    } else if (line.match(/^\d+\.\s+/)) {
      const actionText = line.replace(/^\d+\.\s+/, "").trim();
      if (actionText && currentBranch) {
        items.push({
          branch: currentBranch,
          action: actionText,
          status: "Not started",
          priority: "Medium",
        });
      }
    }
  }

  return items;
};

const writeActionItemsToNotion = async (
  notionConfigured,
  notionDatabaseId,
  actionItems,
  addMessage
) => {
  if (!notionConfigured || !notionDatabaseId) {
    addMessage(
      "assistant",
      "❌ Notion configuration is incomplete. Please check your API key and database ID in Settings."
    );
    return [];
  }

  if (!actionItems || actionItems.length === 0) {
    addMessage("assistant", "❌ No action items to create in Notion.");
    return [];
  }

  const results = [];
  addMessage("system", `🔄 Writing ${actionItems.length} action items to Notion...`);

  for (const item of actionItems) {
    try {
      const pageId = await writeToNotionDatabase(
        notionConfigured,
        notionDatabaseId,
        {
          title: item.action,
          status: item.status || "Not started",
          priority: item.priority || "Medium",
          category: item.branch || "General",
          notes: `Generated from mind map branch: ${item.branch}`,
        },
        addMessage
      );

      if (pageId) {
        results.push({
          id: pageId,
          title: item.action,
          status: item.status,
          branch: item.branch,
        });
      }
    } catch (error) {
      addMessage(
        "assistant",
        `❌ Error creating item "${item.action}": ${error.message}`
      );
    }
  }

  const successCount = results.length;
  const failCount = actionItems.length - successCount;

  addMessage(
    "assistant",
    `✅ Successfully wrote ${successCount} of ${actionItems.length} items to Notion.${
      failCount > 0 ? ` (${failCount} items failed)` : ""
    }`
  );
  return results;
};

const writeToNotionDatabase = async (
  notionConfigured,
  notionDatabaseId,
  {
    title,
    status = "Not started",
    priority = "Medium",
    category = "General",
    dueDate = null,
    notes = "",
  },
  addMessage
) => {
  try {
    if (!title) {
      throw new Error("Title is required");
    }

    if (!notionConfigured) {
      throw new Error("Notion API key is not configured");
    }

    if (!notionDatabaseId) {
      throw new Error("Notion database ID is not configured");
    }

    addMessage("system", "🔄 Verifying database access...");

    const dbData = await callNotionApi(`databases/${notionDatabaseId}`, {
      method: "GET",
    });

    const requiredProperties = ["Name", "Status", "Priority", "Category", "Notes"];
    const missingProperties = requiredProperties.filter(
      (prop) => !dbData.properties[prop]
    );
    if (missingProperties.length > 0) {
      throw new Error(
        `Database is missing required properties: ${missingProperties.join(", ")}`
      );
    }

    const requestBody = {
      parent: {
        database_id: notionDatabaseId,
        type: "database_id",
      },
      properties: {
        Name: {
          type: "title",
          title: [
            {
              type: "text",
              text: { content: title },
            },
          ],
        },
        Status: {
          type: "select",
          select: { name: status },
        },
        Priority: {
          type: "select",
          select: { name: priority },
        },
        Category: {
          type: "select",
          select: { name: category },
        },
        Notes: {
          type: "rich_text",
          rich_text: [
            {
              type: "text",
              text: { content: notes },
            },
          ],
        },
      },
    };

    if (dueDate) {
      if (!dbData.properties.DueDate) {
        console.warn("DueDate property not found in database schema, skipping...");
      } else {
        requestBody.properties.DueDate = {
          type: "date",
          date: {
            start: dueDate,
            time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        };
      }
    }

    const data = await callNotionApi("pages", {
      method: "POST",
      body: requestBody,
    });

    addMessage(
      "assistant",
      `✅ Successfully created Notion page: "${title}"\nView it here: ${data.url}`
    );

    return data.id;
  } catch (error) {
    console.error("Error writing to Notion database:", error);
    addMessage("assistant", `❌ Error writing to Notion database: ${error.message}`);
    return null;
  }
};

export {
  notionTool,
  createNotionDatabase,
  createNotionPage,
  updateNotionPage,
  deleteNotionPage,
  fetchNotionDatabaseContent,
  createNotionWebhook,
  parseActionItems,
  writeActionItemsToNotion,
  writeToNotionDatabase,
};
