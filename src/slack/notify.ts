import type { Announcement } from "../poller/poller.js";

function formatSlackMessage(announcement: Announcement): string {
  const { type, item } = announcement;

  switch (item.type) {
    case "episode": {
      const label =
        type === "new_show" ? "New Show:" :
        type === "new_season" ? "New Season:" :
        "New Episode:";
      const season = String(item.parentIndex ?? 0).padStart(2, "0");
      const episode = String(item.index ?? 0).padStart(2, "0");
      return `*${label}* ${item.grandparentTitle} \u2014 S${season}E${episode} "${item.title}"`;
    }
    case "movie":
      return `*New Movie:* ${item.title} (${item.year ?? "unknown year"})`;
    default:
      return `*New:* ${item.title}`;
  }
}

export async function sendSlackNotification(
  webhookUrl: string,
  announcement: Announcement
): Promise<void> {
  const text = formatSlackMessage(announcement);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text,
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`[slack] Webhook returned ${response.status}: ${await response.text()}`);
    }
  } catch (err) {
    console.error("[slack] Failed to send notification:", err);
  }
}
