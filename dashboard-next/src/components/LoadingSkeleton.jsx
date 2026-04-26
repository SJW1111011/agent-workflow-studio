export default function LoadingSkeleton() {
  return (
    <div className="loading-skeleton">
      <div className="skeleton-header">
        <div className="skeleton-bar skeleton-title"></div>
        <div className="skeleton-bar skeleton-subtitle"></div>
      </div>
      <div className="skeleton-content">
        <div className="skeleton-card">
          <div className="skeleton-bar"></div>
          <div className="skeleton-bar"></div>
          <div className="skeleton-bar short"></div>
        </div>
        <div className="skeleton-card">
          <div className="skeleton-bar"></div>
          <div className="skeleton-bar"></div>
          <div className="skeleton-bar short"></div>
        </div>
        <div className="skeleton-card">
          <div className="skeleton-bar"></div>
          <div className="skeleton-bar"></div>
          <div className="skeleton-bar short"></div>
        </div>
      </div>
    </div>
  );
}
