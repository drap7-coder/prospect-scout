import type { ActivityItem } from "@/lib/intelligence/executiveCard";

/** Compact recent-activity timeline. Hidden entirely when there's nothing fresh. */
export function RecentActivityTimeline({ activity }: { activity: ActivityItem[] }) {
  if (activity.length === 0) return null;
  return (
    <section className="exec-section">
      <h4 className="exec-section-label">Recent activity</h4>
      <ul className="activity-list">
        {activity.map((item) => (
          <li key={item.id} className="activity-item">
            <span aria-hidden className="activity-icon">
              {item.icon}
            </span>
            <span className="activity-body">
              <span className="activity-when">{item.when}</span>
              <span className="activity-text">{item.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
