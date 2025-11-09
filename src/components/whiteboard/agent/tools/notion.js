import React from "react";

// Notion tool configuration
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

// Notion API configuration
const API_BASE_URL =
  process.env.NODE_ENV === "production"
    ? "/api" // In production, use relative URLs
    : "http://localhost:3001/api"; // In development, use the proxy server

// Notion database functions
const createNotionDatabase = async (
  notionApiKey,
  notionDatabaseId,
  addMessage
) => {
  if (!notionApiKey) {
    addMessage(
      "assistant",
      "❌ Notion API key is not configured. Please add it to your .env file."
    );
    return null;
  }

  try {
    // Check if database ID is provided
    if (notionDatabaseId) {
      addMessage(
        "system",
        "🔄 Verifying connection to existing Notion database..."
      );
      // Verify the database exists using our proxy endpoint
      const response = await fetch(
        `${API_BASE_URL}/databases/${notionDatabaseId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${notionApiKey}`
          },
        }
      );

      if (response.ok) {
        addMessage(
          "assistant",
          "✅ Successfully connected to existing Notion database."
        );
        return notionDatabaseId;
      } else {
        // If the database doesn't exist or isn't shared, create a new one
        addMessage(
          "assistant",
          "⚠️ The specified database ID does not exist or is not shared with your integration. Creating a new database..."
        );
      }
    }

    // Create a new database if none exists
    addMessage(
      "system",
      "🔄 Creating a new Notion database for mind map actions..."
    );

    // First, search for a workspace to use as parent
    // Search for a page instead of a database
    const searchResponse = await fetch(`${API_BASE_URL}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${notionApiKey}`
      },
      body: JSON.stringify({
        filter: {
          property: "object",
          value: "page",
        },
        page_size: 1,
      }),
    });

    if (!searchResponse.ok) {
      const errorData = await searchResponse.json();
      throw new Error(
        `Failed to search for pages: ${searchResponse.status} - ${
          errorData.error || "Unknown error"
        }`
      );
    }

    const searchData = await searchResponse.json();

    // Use the first page as parent if available, otherwise create a new page
    let parentId = null;

    if (searchData.results && searchData.results.length > 0) {
      // Use the first page's ID as parent
      parentId = searchData.results[0].id;
    } else {
      // No page found, create a new page as parent
      addMessage(
        "system",
        "🔄 No existing pages found. Creating a new page as parent..."
      );

      const pageResponse = await fetch(`${API_BASE_URL}/pages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${notionApiKey}`
        },
        body: JSON.stringify({
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
        }),
      });

      if (!pageResponse.ok) {
        const errorData = await pageResponse.json();
        throw new Error(
          `Failed to create parent page: ${pageResponse.status} - ${
            errorData.error || "Unknown error"
          }`
        );
      }

      const pageData = await pageResponse.json();
      parentId = pageData.id;
    }

    // Now create the database with the parent ID
    const response = await fetch(`${API_BASE_URL}/databases`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${notionApiKey}`
      },
      body: JSON.stringify({
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
          Name: {
            title: {},
          },
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
          Category: {
            select: {
              options: [],
            },
          },
          DueDate: {
            date: {},
          },
          Notes: {
            rich_text: {},
          },
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Failed to create database: ${response.status} - ${
          errorData.error || "Unknown error"
        }`
      );
    }

    const data = await response.json();
    const newDatabaseId = data.id;

    addMessage(
      "assistant",
      "✅ Successfully created a new Notion database for mind map actions."
    );

    return newDatabaseId;
  } catch (error) {
    console.error("Error with Notion database:", error);
    addMessage("assistant", `❌ Error with Notion: ${error.message}`);
    return null;
  }
};

const createNotionPage = async (
  notionApiKey,
  notionDatabaseId,
  title,
  properties,
  addMessage
) => {
  if (!notionApiKey || !notionDatabaseId) {
    addMessage(
      "assistant",
      "❌ Notion configuration is incomplete. Please check your .env file."
    );
    return null;
  }

  try {
    addMessage("system", `🔄 Creating Notion page: "${title}"...`);

    // Ensure we have a valid parent property with the correct type
    const parent = {
      type: "database_id",
      database_id: notionDatabaseId,
    };

    const response = await fetch(`${API_BASE_URL}/pages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${notionApiKey}`
      },
      body: JSON.stringify({
        parent: parent,
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
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Failed to create page: ${response.status} - ${
          errorData.error || "Unknown error"
        }`
      );
    }

    const data = await response.json();
    addMessage("assistant", `✅ Successfully created Notion page: "${title}"`);

    return data.id;
  } catch (error) {
    console.error("Error creating Notion page:", error);
    addMessage("assistant", `❌ Error creating Notion page: ${error.message}`);
    return null;
  }
};

const updateNotionPage = async (
  notionApiKey,
  pageId,
  properties,
  addMessage
) => {
  if (!notionApiKey) {
    addMessage(
      "assistant",
      "❌ Notion API key is not configured. Please add it to your .env file."
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

    const response = await fetch(`${API_BASE_URL}/pages/${pageId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${notionApiKey}`
      },
      body: JSON.stringify({
        properties,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Failed to update page: ${response.status} - ${
          errorData.error || "Unknown error"
        }`
      );
    }

    const data = await response.json();
    addMessage("assistant", `✅ Successfully updated Notion page.`);

    return data.id;
  } catch (error) {
    console.error("Error updating Notion page:", error);
    addMessage("assistant", `❌ Error updating Notion page: ${error.message}`);
    return null;
  }
};

const deleteNotionPage = async (notionApiKey, pageId, addMessage) => {
  if (!notionApiKey) {
    addMessage(
      "assistant",
      "❌ Notion API key is not configured. Please add it to your .env file."
    );
    return false;
  }

  try {
    addMessage("system", `🔄 Deleting Notion page...`);

    const response = await fetch(`${API_BASE_URL}/pages/${pageId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${notionApiKey}`
      },
      body: JSON.stringify({
        archived: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Failed to delete page: ${response.status} - ${
          errorData.error || "Unknown error"
        }`
      );
    }

    addMessage("assistant", `✅ Successfully deleted Notion page.`);
    return true;
  } catch (error) {
    console.error("Error deleting Notion page:", error);
    addMessage("assistant", `❌ Error deleting Notion page: ${error.message}`);
    return false;
  }
};

const fetchNotionDatabaseContent = async (
  notionApiKey,
  notionDatabaseId,
  addMessage
) => {
  if (!notionApiKey || !notionDatabaseId) {
    return null;
  }

  try {
    addMessage("system", "🔄 Fetching latest Notion database content...");

    const response = await fetch(
      `${API_BASE_URL}/databases/${notionDatabaseId}/query`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${notionApiKey}`
        },
        body: JSON.stringify({
          page_size: 100,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Failed to fetch database content: ${response.status} - ${
          errorData.error || "Unknown error"
        }`
      );
    }

    const data = await response.json();

    // Process the database content
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

// Webhook functions
const createNotionWebhook = async (
  notionApiKey,
  notionDatabaseId,
  addMessage
) => {
  if (!notionApiKey || !notionDatabaseId) {
    addMessage(
      "assistant",
      "❌ Notion configuration is incomplete. Please check your .env file."
    );
    return null;
  }

  try {
    addMessage("system", "🔄 Setting up Notion webhook subscription...");

    // Note: Webhooks are not directly supported in the Notion API client
    // This would typically be handled by a server-side implementation
    addMessage(
      "assistant",
      "✅ Webhook setup would be handled by a server-side implementation."
    );

    // Store webhook ID in localStorage for persistence
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

// Helper functions
const parseActionItems = (actionPlan) => {
  // Simple parsing of markdown to extract action items
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
  notionApiKey,
  notionDatabaseId,
  actionItems,
  addMessage
) => {
  if (!notionApiKey || !notionDatabaseId) {
    console.error('Missing required configuration:', {
      hasApiKey: !!notionApiKey,
      hasDatabaseId: !!notionDatabaseId
    });
    addMessage(
      "assistant",
      "❌ Notion configuration is incomplete. Please check your API key and database ID."
    );
    return [];
  }

  if (!actionItems || actionItems.length === 0) {
    console.error('No action items provided');
    addMessage("assistant", "❌ No action items to create in Notion.");
    return [];
  }


  const results = [];
  addMessage("system", `🔄 Writing ${actionItems.length} action items to Notion...`);

  for (const item of actionItems) {
    try {
      const pageId = await writeToNotionDatabase(
        notionApiKey,
        notionDatabaseId,
        {
          title: item.action,
          status: item.status || "Not started",
          priority: item.priority || "Medium",
          category: item.branch || "General",
          notes: `Generated from mind map branch: ${item.branch}`
        },
        addMessage
      );

      if (pageId) {
        results.push({
          id: pageId,
          title: item.action,
          status: item.status,
          branch: item.branch
        });
      } else {
        console.error('Failed to create Notion page for item:', item);
      }
    } catch (error) {
      console.error('Error creating Notion page for item:', item, error);
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
      failCount > 0 ? ` (${failCount} items failed)` : ''
    }`
  );
  return results;
};

const writeToNotionDatabase = async (
  notionApiKey,
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
    // Input validation
    if (!title) {
      throw new Error('Title is required');
    }

    if (!notionApiKey) {
      throw new Error('Notion API key is not configured');
    }

    if (!notionDatabaseId) {
      throw new Error('Notion database ID is not configured');
    }

    // Ensure API key is properly formatted
    const apiKey = notionApiKey.trim();
    if (!apiKey.startsWith('secret_') && !apiKey.startsWith('ntn_')) {
      console.warn('API key may be invalid - should start with "secret_" or "ntn_"');
    }

    // First, verify the database exists and is accessible
    addMessage("system", "🔄 Verifying database access...");

    const verifyResponse = await fetch(`${API_BASE_URL}/databases/${notionDatabaseId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Notion-Version": "2022-06-28"
      },
    });

    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json();
      console.error('Error accessing Notion database:', {
        status: verifyResponse.status,
        error: errorData,
        databaseId: notionDatabaseId
      });
      throw new Error(`Cannot access database: ${errorData.message || errorData.error || "Unknown error"}`);
    }

    const dbData = await verifyResponse.json();

    // Validate that required properties exist in the database
    const requiredProperties = ['Name', 'Status', 'Priority', 'Category', 'Notes'];
    const missingProperties = requiredProperties.filter(prop => !dbData.properties[prop]);
    if (missingProperties.length > 0) {
      throw new Error(`Database is missing required properties: ${missingProperties.join(', ')}`);
    }

    // Create the page with properties matching the database schema
    const requestBody = {
      parent: {
        database_id: notionDatabaseId,
        type: "database_id"
      },
      properties: {
        "Name": {
          type: "title",
          title: [
            {
              type: "text",
              text: {
                content: title
              }
            }
          ]
        },
        "Status": {
          type: "select",
          select: {
            name: status
          }
        },
        "Priority": {
          type: "select",
          select: {
            name: priority
          }
        },
        "Category": {
          type: "select",
          select: {
            name: category
          }
        },
        "Notes": {
          type: "rich_text",
          rich_text: [
            {
              type: "text",
              text: {
                content: notes
              }
            }
          ]
        }
      }
    };

    // Add due date if provided
    if (dueDate) {
      if (!dbData.properties['DueDate']) {
        console.warn('DueDate property not found in database schema, skipping...');
      } else {
        requestBody.properties["DueDate"] = {
          type: "date",
          date: {
            start: dueDate,
            time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        };
      }
    }

    const response = await fetch(`${API_BASE_URL}/pages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Notion-Version": "2022-06-28"
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error response from Notion API:', {
        status: response.status,
        error: errorData,
        endpoint: 'pages'
      });
      throw new Error(
        `Failed to create page: ${response.status} - ${
          errorData.message || errorData.error || "Unknown error"
        }`
      );
    }

    const data = await response.json();
    
    addMessage("assistant", `✅ Successfully created Notion page: "${title}"\nView it here: ${data.url}`);

    return data.id;
  } catch (error) {
    console.error("Error writing to Notion database:", error);
    addMessage("assistant", `❌ Error writing to Notion database: ${error.message}`);
    return null;
  }
};

// Export everything at the end of the file
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
  writeToNotionDatabase
};
