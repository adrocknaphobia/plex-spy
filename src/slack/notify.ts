import type { Announcement } from "../poller/poller.js";

function formatSlackMessage(announcement: Announcement): string {
  const { type, item } = announcement;

  switch (item.type) {
    case "episode": {
      const label =
        type === "new_show" ? ":sparkles:*_New Show_*:sparkles:" :
        type === "new_season" ? ":sparkles:*_New Season_*:sparkles:" :
        ":tv-new:";
      return `${label} *${item.grandparentTitle} \u2014 Season ${item.parentIndex} Episode ${item.index}: ${item.title}*`;
    }
    case "movie":
      return `:clapper: *${item.title} (${item.year ?? "unknown"})*`;
    default:
      return `:sparkles: *${item.title}*`;
  }
}

function buildBlocks(announcement: Announcement): any[] {
  const text = formatSlackMessage(announcement);
  const { imageUrl, overview, item } = announcement;

  let sectionText = text;
  if (overview) {
    const truncated = overview.length > 300
      ? overview.slice(0, 297) + "..."
      : overview;
    sectionText += `\n${truncated}`;
  }

  const sectionBlock: any = {
    type: "section",
    text: {
      type: "mrkdwn",
      text: sectionText,
    },
  };

  if (imageUrl) {
    sectionBlock.accessory = {
      type: "image",
      image_url: imageUrl,
      alt_text: item.title ?? "Media poster",
    };
  }

  return [sectionBlock];
}

export async function sendSlackNotification(
  webhookUrl: string,
  announcement: Announcement
): Promise<void> {
  const blocks = buildBlocks(announcement);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });

    if (!response.ok) {
      console.error(`[slack] Webhook returned ${response.status}: ${await response.text()}`);
    }
  } catch (err) {
    console.error("[slack] Failed to send notification:", err);
  }
}
